using Xunit;
using PhoneBox.Agent;
using Microsoft.Extensions.Logging.Abstractions;

/// <summary>Downloads the real Platform-Tools from Google: runs only with PHONEDASH_NET_TESTS=1 (Windows).</summary>
public sealed class AdbProvisionTests
{
    [Fact]
    public async Task DownloadsAdbIntoThePhoneDashFolder()
    {
        if (!OperatingSystem.IsWindows() || Environment.GetEnvironmentVariable("PHONEDASH_NET_TESTS") != "1") return;
        if (Directory.Exists(AdbProvision.Folder)) Directory.Delete(AdbProvision.Folder, true);
        AdbProvision.Start(NullLogger.Instance);
        var until = DateTime.UtcNow.AddMinutes(3);
        while (!File.Exists(AdbProvision.LocalAdb) && DateTime.UtcNow < until) await Task.Delay(500);
        Assert.True(File.Exists(AdbProvision.LocalAdb), AdbProvision.Status);
        Assert.Equal("", AdbProvision.Status);
        Assert.False(File.Exists(Path.Combine(AppPaths.LocalDir, "platform-tools.download.zip")));
    }
}
