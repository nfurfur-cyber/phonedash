namespace PhoneBox.Agent;

/// <summary>macOS / Linux: PhoneDash releases are for Windows; a build for another system runs where it is (see the Windows SelfInstall.cs).</summary>
public static class SelfInstall
{
    public static bool Wanted(string[] args) => false;
    public static bool Install() => false;
    public static void Uninstall(bool ask = true) { }
}
