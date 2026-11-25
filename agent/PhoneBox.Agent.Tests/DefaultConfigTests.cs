using PhoneBox.Agent;
using Xunit;
using System.Text.Json;

/// <summary>The file a first run starts from names the same first page as an empty page list does.</summary>
public sealed class DefaultConfigTests
{
    [Theory]
    [InlineData("config.default.json")]
    [InlineData("config.default.linux.json")]
    [InlineData("config.default.macos.json")]
    public void StartsWithTheDefaultFirstPage(string name)
    {
        using var stream = typeof(ConfigStore).Assembly.GetManifestResourceStream(name)!;
        using var doc = JsonDocument.Parse(stream, new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });
        var first = doc.RootElement.GetProperty("pages")[0].GetProperty("template").GetString();
        Assert.Equal(ConfigStore.DefaultPages[0], first);
        Assert.Equal("board", first);
    }
}
