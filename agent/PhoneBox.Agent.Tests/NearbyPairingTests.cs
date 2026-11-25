using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using PhoneBox.Agent;
using Xunit;

public sealed class NearbyPairingTests
{
    private const long Now = 1_800_000_000_000;
    private const long Until = Now + PairingCodes.LifetimeMs;
    private static readonly string Fp = new('a', 64);
    private static readonly byte[] PhoneNonce = Enumerable.Range(1, 16).Select(i => (byte)i).ToArray();
    private static string Hex(byte[] b) => Convert.ToHexStringLower(b);
    private static string Commit => Hex(NearbyPairing.Commitment(PhoneNonce));

    private static NearbyPairing Opened()
    {
        var nearby = new NearbyPairing();
        nearby.Open(1, Until);
        return nearby;
    }

    private readonly Dictionary<string, string> _codes = [];
    private string Code(NearbyPairing nearby, string id)
    {
        Assert.Contains(_codes[id], nearby.Pending(Now)!.Choices);
        return _codes[id];
    }

    private string Waiting(NearbyPairing nearby, long now = Now)
    {
        var begun = nearby.Begin(Commit, "samsung SM-E426S", now)!;
        Assert.True(nearby.Reveal(begun.Id, Hex(PhoneNonce), Fp, now));
        _codes[begun.Id] = NearbyPairing.Number(Convert.FromHexString(Fp), Convert.FromHexString(begun.Nonce), PhoneNonce);
        return begun.Id;
    }

    // the phone (NearbyCode.kt) has the same vectors: both sides must agree to the digit
    [Fact]
    public void TheNumberAndCommitmentAreTheOnesThePhoneComputes()
    {
        var fp = Enumerable.Repeat((byte)0xaa, 32).ToArray();
        var pc = Enumerable.Range(16, 16).Select(i => (byte)i).ToArray();
        Assert.Equal(Hex(SHA256.HashData([.. Encoding.ASCII.GetBytes("phonedash-nearby-commit-1"), 0, .. PhoneNonce])), Commit);
        var number = NearbyPairing.Number(fp, pc, PhoneNonce);
        Assert.Matches(@"^\d{3} \d{3}$", number);
        Assert.Equal(NumberVector, number);
        Assert.Equal(CommitVector, Commit);
    }

    internal const string NumberVector = "571 156";
    internal const string CommitVector = "fdf392addb3e9a7053b279f093f93f3151eaf5f22179f6511bc14f142d93c3ab";

    [Fact]
    public void TheWholeWayAndTheKeyIsGivenOnce()
    {
        var nearby = Opened();
        var begun = nearby.Begin(Commit, "samsung SM-E426S", Now)!;
        Assert.Null(nearby.Pending(Now)); // nothing to show before the phone revealed its value
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(begun.Id, Now));
        Assert.True(nearby.Reveal(begun.Id, Hex(PhoneNonce), Fp, Now));
        var shown = nearby.Pending(Now)!;
        Assert.Equal("samsung SM-E426S", shown.Model);
        var code = NearbyPairing.Number(Convert.FromHexString(Fp), Convert.FromHexString(begun.Nonce), PhoneNonce);
        Assert.Contains(code, shown.Choices);
        Assert.Equal(NearbyPairing.ChoiceCount, shown.Choices.Distinct().Count());
        Assert.All(shown.Choices, c => Assert.Matches(@"^\d{3} \d{3}$", c));
        Assert.Equal(shown.Choices, nearby.Pending(Now)!.Choices); // the same until it is answered
        Assert.Equal(NearbyPairing.Answer.Waiting, nearby.Poll(begun.Id, Now));
        Assert.True(nearby.Decide(begun.Id, code, Now));
        Assert.False(nearby.Decide(begun.Id, null, Now)); // answered
        Assert.Null(nearby.Pending(Now));
        Assert.Equal(NearbyPairing.Answer.Allowed, nearby.Poll(begun.Id, Now));
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(begun.Id, Now));
    }

    [Fact]
    public void NothingIsAnsweredWhileTheDialogIsClosed()
    {
        var nearby = new NearbyPairing();
        Assert.Null(nearby.Begin(Commit, "x", Now));
        nearby.Open(1, Until);
        Assert.Null(nearby.Begin(Commit, "x", Until)); // expired
        var id = Waiting(nearby);
        nearby.Close(0); // an older dialog
        Assert.Equal(NearbyPairing.Answer.Waiting, nearby.Poll(id, Now));
        var code = Code(nearby, id);
        nearby.Close(1);
        Assert.False(nearby.IsOpen(Now));
        Assert.False(nearby.Decide(id, code, Now));
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(id, Now));
    }

    [Fact]
    public void AnAllowedRequestIsNotGivenAfterTheDialogClosed()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        Assert.True(nearby.Decide(id, Code(nearby, id), Now));
        nearby.Close(1);
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(id, Now));
    }

    [Fact]
    public void AWrongRevealEndsTheRequest()
    {
        var nearby = Opened();
        var begun = nearby.Begin(Commit, "x", Now)!;
        Assert.False(nearby.Reveal(begun.Id, new string('0', 32), Fp, Now));
        Assert.False(nearby.Reveal(begun.Id, Hex(PhoneNonce), Fp, Now)); // no second try against the same nonce
        Assert.Null(nearby.Pending(Now));
    }

    [Fact]
    public void AValueIsRevealedOnce()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        Assert.False(nearby.Reveal(id, Hex(PhoneNonce), Fp, Now));
        Assert.NotNull(nearby.Pending(Now));
    }

    [Fact]
    public void OnePhoneAtATimeAndASilentOneMakesRoom()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        Assert.Null(nearby.Begin(Commit, "second", Now + 1000));
        nearby.Poll(id, Now + 5000);
        Assert.Null(nearby.Begin(Commit, "second", Now + 5000 + NearbyPairing.SilenceMs));
        Assert.NotNull(nearby.Begin(Commit, "second", Now + 5001 + NearbyPairing.SilenceMs));
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(id, Now + 5001 + NearbyPairing.SilenceMs));
    }

    [Fact]
    public void APhoneCannotWaitForEver()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        for (var t = Now; t <= Now + NearbyPairing.RequestLifetimeMs; t += 1000) Assert.Equal(NearbyPairing.Answer.Waiting, nearby.Poll(id, t));
        Assert.Equal(NearbyPairing.Answer.Unknown, nearby.Poll(id, Now + NearbyPairing.RequestLifetimeMs + 1));
    }

    [Fact]
    public void RefusedWithdrawnAndWrongIds()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        Assert.False(nearby.Decide("nope", Code(nearby, id), Now));
        Assert.False(nearby.Decide(null, Code(nearby, id), Now));
        Assert.False(nearby.Decide(id, null, Now));
        Assert.Equal(NearbyPairing.Answer.Denied, nearby.Poll(id, Now));
        var second = Waiting(nearby);
        nearby.Withdraw(id, Now); // an old id
        Assert.NotNull(nearby.Pending(Now));
        nearby.Withdraw(second, Now);
        Assert.Null(nearby.Pending(Now));
    }

    // the numbers are compared by pressing the right one: a wrong one ends the request, it is not a second try
    [Fact]
    public void AWrongNumberRefusesForGood()
    {
        var nearby = Opened();
        var id = Waiting(nearby);
        var code = Code(nearby, id);
        Assert.False(nearby.Decide(id, nearby.Pending(Now)!.Choices.First(c => c != code), Now));
        Assert.False(nearby.Decide(id, code, Now));
        Assert.Equal(NearbyPairing.Answer.Denied, nearby.Poll(id, Now));
    }

    // a stranger that only begins does not keep the place from the phone in the user's hand
    [Fact]
    public void ARequestThatWasNotRevealedMakesRoomAtOnce()
    {
        var nearby = Opened();
        var silent = nearby.Begin(Commit, "stranger", Now)!;
        var id = Waiting(nearby);
        Assert.Equal("samsung SM-E426S", nearby.Pending(Now)!.Model);
        Assert.False(nearby.Reveal(silent.Id, Hex(PhoneNonce), Fp, Now));
        Assert.Equal(NearbyPairing.Answer.Waiting, nearby.Poll(id, Now));
    }

    [Fact]
    public void ANoisyNetworkCannotNagForEver()
    {
        var nearby = Opened();
        for (var i = 0; i < NearbyPairing.MaxRequests; i++) nearby.Withdraw(nearby.Begin(Commit, "x", Now)!.Id, Now);
        Assert.Null(nearby.Begin(Commit, "x", Now));
        nearby.Open(2, Until); // opened again by the user
        Assert.NotNull(nearby.Begin(Commit, "x", Now));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("zz")]
    [InlineData("ab")]
    public void ABadCommitmentIsRefused(string? commit) => Assert.Null(Opened().Begin(commit, "x", Now));

    [Fact]
    public void TheModelCannotCarryMarkupControlCharactersOrLength()
    {
        var nearby = Opened();
        var begun = nearby.Begin(Commit, "evil\u0000\n‮" + new string('x', 100), Now)!;
        nearby.Reveal(begun.Id, Hex(PhoneNonce), Fp, Now);
        Assert.Equal("evil" + new string('x', 36), nearby.Pending(Now)!.Model);
        nearby.Withdraw(begun.Id, Now);
        Assert.Equal("Android phone", Model(nearby, "한글"));
    }

    private static string Model(NearbyPairing nearby, string model)
    {
        var begun = nearby.Begin(Commit, model, Now)!;
        nearby.Reveal(begun.Id, Hex(PhoneNonce), Fp, Now);
        return nearby.Pending(Now)!.Model;
    }

    [Theory]
    [InlineData("POST", "/api/pair/nearby/begin", true)]
    [InlineData("POST", "/api/pair/nearby/reveal", true)]
    [InlineData("POST", "/api/pair/nearby/poll", true)]
    [InlineData("POST", "/api/pair/nearby/withdraw", true)]
    [InlineData("GET", "/api/pair/nearby/poll", false)]
    [InlineData("POST", "/api/pair/nearby/decide", false)] // Connect is pressed on this computer only
    [InlineData("POST", "/api/pair/nearby", false)]
    [InlineData("POST", "/api/pair/nearby/poll/x", false)]
    [InlineData("GET", "/api/pair/status", false)]
    public void OnlyThePhonesStepsAreOpenOnTheWifi(string method, string path, bool open)
    {
        var lan = new LanConfig { Enabled = true, Port = 8776, Token = "phone-tok", WebhookToken = "hook-tok" };
        Assert.Equal(open, Lan.AuthorizeRequest(lan, method, new PathString(path), "", null, null) == Lan.LanAccess.PairingClaim);
        Assert.Equal(Lan.LanAccess.Denied, Lan.AuthorizeRequest(lan, method, new PathString(path), "https://evil.example", null, null));
        // not even a paired phone may answer for the user
        if (path.EndsWith("decide")) Assert.Equal(Lan.LanAccess.Denied, Lan.AuthorizeRequest(lan, method, new PathString(path), "", "Bearer phone-tok", null));
    }

    [Theory]
    [InlineData("text/plain", "{}")]
    [InlineData("application/json", "{ not json")]
    [InlineData("application/json", """{"id":5}""")]
    [InlineData(null, "{}")]
    public async Task ABadBodyIsNull(string? type, string body)
    {
        var ctx = new DefaultHttpContext();
        if (type is not null) ctx.Request.ContentType = type;
        ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        Assert.Null(await NearbyPairing.ReadBodyAsync(ctx.Request));
    }

    // ---- discovery
    private static readonly IPAddress Phone = IPAddress.Parse("192.168.0.20");
    private static byte[] Question(string nonce = "0123456789abcdef", int size = NearbyDiscovery.QuestionBytes) =>
        Encoding.ASCII.GetBytes($"PHONEDASH? 1 {nonce}".PadRight(size));

    private static NearbyDiscovery Discovery(NearbyPairing nearby, bool lan = true)
    {
        var path = Path.Combine(Path.GetTempPath(), "pd-nearby-" + Guid.NewGuid().ToString("N") + ".json");
        File.WriteAllText(path, JsonSerializer.Serialize(new { lan = new { enabled = lan } }));
        return new NearbyDiscovery(nearby, new ConfigStore(path), new NearbyIdentity("DESK", 8776, Fp), NullLogger<NearbyDiscovery>.Instance);
    }

    [Fact]
    public void AQuestionIsAnsweredWhileTheDialogIsOpen()
    {
        var answer = Discovery(Opened()).Reply(Question(), Phone, Now)!;
        Assert.True(answer.Length <= NearbyDiscovery.QuestionBytes);
        var j = JsonDocument.Parse(answer).RootElement;
        Assert.Equal("0123456789abcdef", j.GetProperty("nonce").GetString());
        Assert.Equal("DESK", j.GetProperty("pc").GetString());
        Assert.Equal(8776, j.GetProperty("port").GetInt32());
        Assert.Equal(Fp, j.GetProperty("fp").GetString());
        Assert.False(j.TryGetProperty("token", out _));
    }

    [Fact]
    public void AQuestionIsNotAnsweredOtherwise()
    {
        Assert.Null(Discovery(new NearbyPairing()).Reply(Question(), Phone, Now)); // dialog closed
        Assert.Null(Discovery(Opened(), lan: false).Reply(Question(), Phone, Now)); // Wi-Fi turned off
        Assert.Null(Discovery(Opened()).Reply(Question(), IPAddress.Parse("8.8.8.8"), Now));
        Assert.Null(Discovery(Opened()).Reply(Question(size: 60), Phone, Now)); // smaller than an answer
        Assert.Null(Discovery(Opened()).Reply(Question("0123456789ABCDEF"), Phone, Now));
        Assert.Null(Discovery(Opened()).Reply(Encoding.ASCII.GetBytes("hello".PadRight(400)), Phone, Now));
    }

    [Fact]
    public void AnswersAreLimitedPerSecond()
    {
        var discovery = Discovery(Opened());
        Assert.Equal(20, Enumerable.Range(0, 100).Count(_ => discovery.Reply(Question(), Phone, Now) is not null));
        Assert.NotNull(discovery.Reply(Question(), Phone, Now + 1000));
    }

    [Theory]
    [InlineData("10.1.2.3", true)]
    [InlineData("172.16.0.1", true)]
    [InlineData("172.32.0.1", false)]
    [InlineData("192.168.1.1", true)]
    [InlineData("::ffff:192.168.1.1", true)]
    [InlineData("fe80::1", false)]
    [InlineData("127.0.0.1", false)]
    public void OnlyPrivateAddressesAreAnswered(string address, bool ok) => Assert.Equal(ok, NearbyDiscovery.IsPrivate(IPAddress.Parse(address)));

    [Theory]
    [InlineData("List of devices attached\nR95\tunauthorized\n", 1)]
    [InlineData("List of devices attached\nR95\tdevice\nX\tunauthorized\r\n", 1)]
    [InlineData("List of devices attached\nR95\tdevice\n", 0)]
    [InlineData("", 0)]
    public void AdbTellsWhichPhonesStillHaveToAllowDebugging(string output, int count) =>
        Assert.Equal(count, AdbReverse.Unauthorized(output));
}
