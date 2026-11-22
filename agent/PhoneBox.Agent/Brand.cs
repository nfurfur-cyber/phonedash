namespace PhoneBox.Agent;

/// <summary>
/// PhoneDash identity. <see cref="Owner"/> is the GitHub account that hosts the PhoneDash site and the PC program
/// releases (https://&lt;owner&gt;.github.io/phonedash/, github.com/&lt;owner&gt;/phonedash). Set it with
/// <c>node tools/set-owner.mjs &lt;owner&gt;</c>, which also sets the phone app's pairing host.
/// </summary>
public static class Brand
{
    public const string Name = "PhoneDash";
    public const string AppId = "kr.phonedash.app";
    public const string Owner = "nfurfur-cyber";

    /// <summary>GitHub repository with the PC program releases, or null while <see cref="Owner"/> is not set.</summary>
    public static string? Repo => Owner.Length > 0 ? Owner + "/phonedash" : null;

    /// <summary>The PhoneDash site: setup guide, PC program download, privacy policy, Wi-Fi pairing page.</summary>
    public static string SiteUrl => Owner.Length > 0 ? $"https://{Owner.ToLowerInvariant()}.github.io/phonedash/" : "https://phonedash.invalid/phonedash/";

    public static string PairUrl => SiteUrl + "pair/";

    /// <summary>The phone app's Play Store page (web), for QR codes and links.</summary>
    public const string PlayStoreUrl = "https://play.google.com/store/apps/details?id=" + AppId;

    /// <summary>Opens the Play Store app on the phone at PhoneDash's page.</summary>
    public const string MarketUri = "market://details?id=" + AppId;
}
