using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using PhoneBox.Agent;
using Xunit;

/// <summary>The phone's requests as the agent answers them: what each step returns and when the key is handed out.</summary>
public sealed class NearbyStepTests : IDisposable
{
    private readonly string _dir = Directory.CreateTempSubdirectory("phonedash-nearby-").FullName;
    private readonly ConfigStore _cfg;
    private readonly System.Security.Cryptography.X509Certificates.X509Certificate2 _cert;
    private readonly PairingCodes _codes = new();
    private readonly NearbyPairing _nearby = new();
    private static readonly byte[] PhoneNonce = Enumerable.Range(1, 16).Select(i => (byte)i).ToArray();

    public NearbyStepTests()
    {
        _cfg = new ConfigStore(Path.Combine(_dir, "config.json"));
        Assert.Null(_cfg.Save("""{"lan":{"enabled":true,"token":"the-wifi-key-0123456789","webhookToken":"hook-0123456789"}}"""));
        _cert = Lan.Certificate(_dir);
    }

    public void Dispose() { _cert.Dispose(); Directory.Delete(_dir, recursive: true); }

    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    private static string Commit => Convert.ToHexStringLower(NearbyPairing.Commitment(PhoneNonce));

    private async Task<(int Status, JsonElement Body)> Step(string step, object body)
    {
        var ctx = new DefaultHttpContext { RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider() };
        ctx.Request.Method = "POST";
        ctx.Request.ContentType = "application/json";
        ctx.Request.Headers["X-PhoneBox-Model"] = "samsung SM-E426S";
        ctx.Request.Body = new MemoryStream(JsonSerializer.SerializeToUtf8Bytes(body));
        ctx.Response.Body = new MemoryStream();
        var result = await Program.NearbyStepAsync(step, ctx.Request, _cfg, _codes, _nearby, _cert, 8776, NullLogger.Instance);
        await result.ExecuteAsync(ctx);
        var text = Encoding.UTF8.GetString(((MemoryStream)ctx.Response.Body).ToArray());
        return (ctx.Response.StatusCode, text.Length > 0 ? JsonDocument.Parse(text).RootElement : default);
    }

    private string _code = "";

    private async Task<string> Asked()
    {
        var (code, expires, attempt) = _codes.Start(Now);
        _nearby.Open(attempt, expires);
        var begun = await Step("begin", new { commit = Commit });
        Assert.Equal(200, begun.Status);
        var id = begun.Body.GetProperty("id").GetString()!;
        var nonce = begun.Body.GetProperty("nonce").GetString()!;
        _code = NearbyPairing.Number(Convert.FromHexString(Lan.Fingerprint(_cert)), Convert.FromHexString(nonce), PhoneNonce);
        Assert.Equal(200, (await Step("reveal", new { id, nonce = Convert.ToHexStringLower(PhoneNonce) })).Status);
        return id;
    }

    [Fact]
    public async Task TheKeyIsHandedOutOnceAndOnlyAfterTheRightNumber()
    {
        var id = await Asked();
        var waiting = await Step("poll", new { id });
        Assert.Equal(202, waiting.Status);
        Assert.Equal(JsonValueKind.Undefined, waiting.Body.ValueKind);
        Assert.Equal("samsung SM-E426S", _nearby.Pending(Now)!.Model);

        Assert.True(_nearby.Decide(id, _code, Now));
        var paired = await Step("poll", new { id });
        Assert.Equal(200, paired.Status);
        Assert.Equal("the-wifi-key-0123456789", paired.Body.GetProperty("token").GetString());
        Assert.Equal(Lan.Fingerprint(_cert), paired.Body.GetProperty("fingerprint").GetString());
        Assert.Equal(1, _codes.Claims); // the dialog sees it and closes
        Assert.Equal(403, (await Step("poll", new { id })).Status);
    }

    [Fact]
    public async Task RefusedMeansNoKey()
    {
        var id = await Asked();
        _nearby.Decide(id, null, Now);
        Assert.Equal(403, (await Step("poll", new { id })).Status);
        Assert.Equal(0, _codes.Claims);
    }

    [Fact]
    public async Task WithdrawnMeansNoKey()
    {
        var id = await Asked();
        Assert.Equal(200, (await Step("withdraw", new { id })).Status);
        Assert.False(_nearby.Decide(id, _code, Now));
        Assert.Equal(403, (await Step("poll", new { id })).Status);
    }

    [Fact]
    public async Task NothingIsAnsweredWithoutTheDialog()
    {
        Assert.Equal(403, (await Step("begin", new { commit = Commit })).Status);
        Assert.Equal(403, (await Step("reveal", new { id = "x", nonce = "y" })).Status);
        Assert.Equal(403, (await Step("poll", new { id = "x" })).Status);
        Assert.Equal(404, (await Step("decide", new { id = "x" })).Status);
    }

    [Fact]
    public async Task WifiTurnedOffWhileAPhoneWaitsMeansNoKey()
    {
        var id = await Asked();
        Assert.True(_nearby.Decide(id, _code, Now));
        Assert.Null(_cfg.Save("""{"lan":{"enabled":false}}"""));
        Assert.Equal(403, (await Step("poll", new { id })).Status);
    }

    [Fact]
    public void TheDialogSaysWhatTheCableIsDoing()
    {
        using var adb = new AdbReverse(_cfg, NullLogger<AdbReverse>.Instance);
        PhoneSeen Seen(string via, long ago) => new("id", "model", Now - ago, via);
        Assert.Equal("none", Program.UsbState(adb, [], Now));
        Assert.Equal("connected", Program.UsbState(adb, [Seen("USB", 2000)], Now));
        Assert.Equal("none", Program.UsbState(adb, [Seen("USB", 20_000), Seen("Wi-Fi", 0)], Now));
    }
}
