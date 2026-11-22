using System.Diagnostics;
using System.Runtime.Versioning;

namespace PhoneBox.Agent;

/// <summary>
/// PhoneDash on Windows: the buyer downloads PhoneDashAgent.exe and double-clicks it. Started from anywhere but the
/// install folder, the program copies itself there (replacing an older copy, which is stopped first), adds a Start menu
/// shortcut, a sign-in shortcut and an "Apps &amp; features" entry (all per user, no administrator rights), starts the
/// installed copy with <c>--welcome</c> and exits. <c>--uninstall</c> removes all of it again but keeps the settings.
/// <c>--portable</c> (or <c>--config</c>/<c>--port</c>) runs the program where it is, as before.
/// </summary>
[SupportedOSPlatform("windows")]
public static class SelfInstall
{
    private const string ExeName = "PhoneDashAgent.exe";
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\PhoneDash";

    public static string InstalledExe => Path.Combine(AppPaths.InstallDir, ExeName);

    private static string StartMenuShortcut => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppPaths.AppName + ".lnk");

    /// <summary>True when this launch should install the program instead of running it.</summary>
    public static bool Wanted(string[] args) =>
        !UpdateService.RunningInstalled
        && !args.Any(a => a is "--portable" or "--config" or "--port" or "--restart" or "--uninstall")
        && Environment.ProcessPath is { } path && path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase);

    /// <summary>Installs this copy and starts the installed one. Returns false (run here instead) when copying failed.</summary>
    public static bool Install()
    {
        var source = Environment.ProcessPath!;
        try
        {
            Directory.CreateDirectory(AppPaths.InstallDir);
            StopInstalledCopies();
            CopyWithRetry(source, InstalledExe);
            CopyNotices(Path.GetDirectoryName(source)!);
            CreateShortcut(StartMenuShortcut, InstalledExe);
            CreateShortcut(AppPaths.StartupShortcut, InstalledExe);
            RegisterUninstall();
            Process.Start(new ProcessStartInfo(InstalledExe, "--welcome") { WorkingDirectory = AppPaths.InstallDir, UseShellExecute = false })?.Dispose();
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or System.Runtime.InteropServices.COMException)
        {
            MessageBox.Show($"PhoneDash could not be installed ({ex.Message}). It will run from this folder instead.", "PhoneDash",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }
    }

    /// <summary>Removes the program, its shortcuts and the "Apps &amp; features" entry. Settings and logs stay.</summary>
    public static void Uninstall(bool ask = true)
    {
        if (ask && MessageBox.Show("Remove PhoneDash from this computer? Your settings are kept.\n\n이 컴퓨터에서 폰대시를 지울까요? 설정은 남겨 둡니다.",
            "PhoneDash", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return;
        StopInstalledCopies();
        foreach (var lnk in new[] { StartMenuShortcut, AppPaths.StartupShortcut })
            try { File.Delete(lnk); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        try { Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, throwOnMissingSubKey: false); }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException) { }
        // this exe may be the one being removed: a short-lived cmd deletes the folder once this process has exited
        var dir = AppPaths.InstallDir.Replace("\"", "");
        Process.Start(new ProcessStartInfo("cmd.exe", $"/c timeout /t 2 /nobreak >nul & rmdir /s /q \"{dir}\"")
        { CreateNoWindow = true, UseShellExecute = false })?.Dispose();
    }

    private static void StopInstalledCopies()
    {
        foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(ExeName)))
        {
            try
            {
                if (p.Id == Environment.ProcessId) continue;
                var file = p.MainModule?.FileName;
                if (file is null || !string.Equals(Path.GetFullPath(file), Path.GetFullPath(InstalledExe), StringComparison.OrdinalIgnoreCase)) continue;
                p.Kill();
                p.WaitForExit(10_000);
            }
            catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception) { }
            finally { p.Dispose(); }
        }
    }

    private static void CopyWithRetry(string from, string to)
    {
        if (string.Equals(Path.GetFullPath(from), Path.GetFullPath(to), StringComparison.OrdinalIgnoreCase)) return;
        for (var attempt = 1; ; attempt++)
        {
            try { File.Copy(from, to, overwrite: true); return; }
            catch (IOException) when (attempt < 10) { Thread.Sleep(500); } // the old copy may still be letting go of the file
        }
    }

    /// <summary>The licence texts travel with the program (MIT: the original copyright notice must stay with every copy).</summary>
    private static void CopyNotices(string sourceDir)
    {
        foreach (var name in new[] { "LICENSE.txt", "THIRD-PARTY-NOTICES.txt" })
        {
            var from = Path.Combine(sourceDir, name);
            var to = Path.Combine(AppPaths.InstallDir, name);
            if (File.Exists(from)) { CopyWithRetry(from, to); continue; }
            using var embedded = AppPaths.Resource(name);
            if (embedded is null) continue;
            using var file = File.Create(to);
            embedded.CopyTo(file);
        }
    }

    private static void CreateShortcut(string path, string target)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var shellType = Type.GetTypeFromProgID("WScript.Shell") ?? throw new IOException("WScript.Shell is not available");
        dynamic shell = Activator.CreateInstance(shellType)!;
        dynamic lnk = shell.CreateShortcut(path);
        lnk.TargetPath = target;
        lnk.WorkingDirectory = Path.GetDirectoryName(target);
        lnk.Description = "PhoneDash";
        lnk.Save();
    }

    private static void RegisterUninstall()
    {
        using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(UninstallKey);
        key.SetValue("DisplayName", "PhoneDash (폰대시)");
        key.SetValue("DisplayVersion", AppPaths.Version);
        key.SetValue("Publisher", "PhoneDash");
        key.SetValue("DisplayIcon", InstalledExe);
        key.SetValue("InstallLocation", AppPaths.InstallDir);
        key.SetValue("UninstallString", $"\"{InstalledExe}\" --uninstall");
        key.SetValue("NoModify", 1, Microsoft.Win32.RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, Microsoft.Win32.RegistryValueKind.DWord);
    }
}
