using System.IO.Compression;

namespace PhoneBox.Agent;

/// <summary>
/// PhoneDash on Windows: when no adb is found, the program fetches Google's Android SDK Platform-Tools
/// (dl.google.com, the same package "winget install Google.PlatformTools" installs) into %LOCALAPPDATA%\PhoneDash\platform-tools,
/// so a buyer never has to install adb by hand. One download at a time; a failed one is tried again after a while.
/// </summary>
public static class AdbProvision
{
    private const string Url = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip";
    private static readonly TimeSpan RetryAfter = TimeSpan.FromMinutes(10);
    private static int _running;
    private static DateTime _lastFailure = DateTime.MinValue;

    public static string Folder => Path.Combine(AppPaths.LocalDir, "platform-tools");
    public static string LocalAdb => Path.Combine(Folder, "adb.exe");

    /// <summary>What the settings page shows while adb is missing.</summary>
    public static string Status { get; private set; } = "";

    /// <summary>Starts the download in the background unless one is running or failed a moment ago.</summary>
    public static void Start(ILogger log)
    {
        if (!OperatingSystem.IsWindows() || File.Exists(LocalAdb)) return;
        if (DateTime.UtcNow - _lastFailure < RetryAfter) return;
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        _ = Task.Run(async () =>
        {
            try { await DownloadAsync(log); }
            catch (Exception ex)
            {
                _lastFailure = DateTime.UtcNow;
                Status = "could not download adb: " + ex.Message;
                log.LogWarning("adb download failed: {Message}", ex.Message);
            }
            finally { Interlocked.Exchange(ref _running, 0); }
        });
    }

    private static async Task DownloadAsync(ILogger log)
    {
        Status = "downloading adb (Android SDK Platform-Tools from Google)…";
        log.LogInformation("adb not found: downloading Android SDK Platform-Tools from {Url}", Url);
        Directory.CreateDirectory(AppPaths.LocalDir);
        var zip = Path.Combine(AppPaths.LocalDir, "platform-tools.download.zip");
        var staging = Path.Combine(AppPaths.LocalDir, "platform-tools.staging");
        using (var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) })
        {
            http.DefaultRequestHeaders.UserAgent.ParseAdd("PhoneDash/" + AppPaths.Version);
            await using var body = await http.GetStreamAsync(Url);
            await using var file = File.Create(zip);
            await body.CopyToAsync(file);
        }
        if (Directory.Exists(staging)) Directory.Delete(staging, true);
        ZipFile.ExtractToDirectory(zip, staging);
        var extracted = Path.Combine(staging, "platform-tools");
        if (!File.Exists(Path.Combine(extracted, "adb.exe"))) throw new InvalidDataException("the download has no platform-tools\\adb.exe");
        if (Directory.Exists(Folder)) Directory.Delete(Folder, true);
        Directory.Move(extracted, Folder);
        Directory.Delete(staging, true);
        File.Delete(zip);
        Status = "";
        log.LogInformation("adb installed at {Path}", LocalAdb);
    }
}
