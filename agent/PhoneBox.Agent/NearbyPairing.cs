using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace PhoneBox.Agent;

/// <summary>
/// Pairing a phone on the same Wi-Fi without a QR code. While the pairing dialog is open on this computer (never
/// otherwise), the phone finds it (<see cref="NearbyDiscovery"/>) and asks to pair over TLS. Nothing on the network is
/// trusted so far, so both sides make a six-digit number from the certificate the phone sees and a random value of each
/// side. The phone shows it and its user confirms it; here it stands among others, and the key is only handed out when
/// the right one is pressed. A plain Connect button could be pressed without a look at the phone, and the key would go to
/// whoever asked (a neighbour, or someone in the middle, who could also send any "confirmed" message).
///
/// The phone commits to its random value before it learns this computer's, so someone in the middle (with a certificate
/// of their own) cannot search for values that give both screens the same number: one blind try in a million.
/// </summary>
public sealed class NearbyPairing
{
    /// <summary>A phone that stops asking (closed, out of range) frees the place for another one.</summary>
    public const long SilenceMs = 8_000;
    public const long RequestLifetimeMs = 2 * 60_000;
    /// <summary>Requests per open dialog; after that only the QR code is left (a noisy network cannot nag for ever).</summary>
    public const int MaxRequests = 20;
    /// <summary>Numbers the dialog shows, the right one among them.</summary>
    public const int ChoiceCount = 3;

    public enum Answer { Unknown, Waiting, Denied, Allowed }
    public sealed record Begun(string Id, string Nonce);
    public sealed record Shown(string Id, string Model, IReadOnlyList<string> Choices);

    private sealed record Request(string Id, byte[] Commit, byte[] Nonce, string Model, long StartedAt, long SeenAt, string? Code, IReadOnlyList<string> Choices, Answer State);

    private readonly Lock _lock = new();
    private long _attempt = -1;
    private long _openUntil;
    private int _requests;
    private Request? _request;

    /// <summary>The pairing dialog opened: phones may ask until it closes or <paramref name="until"/> passes.</summary>
    public void Open(long attempt, long until)
    {
        lock (_lock) (_attempt, _openUntil, _requests, _request) = (attempt, until, 0, null);
    }

    /// <summary>The dialog of this attempt closed; a newer dialog is left alone.</summary>
    public void Close(long attempt)
    {
        lock (_lock) if (attempt == _attempt) (_attempt, _request) = (-1, null);
    }

    public bool IsOpen(long now) { lock (_lock) return Open(now); }

    private bool Open(long now) => _attempt >= 0 && now < _openUntil;

    /// <summary>First step: the phone's commitment. Null while the dialog is closed or another phone is asking.</summary>
    public Begun? Begin(string? commit, string? model, long now)
    {
        if (Bytes(commit, 32) is not { } committed) return null;
        lock (_lock)
        {
            if (!Open(now) || Current(now) is { State: Answer.Waiting, Code: not null } || _requests >= MaxRequests) return null;
            _requests++;
            var id = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));
            var nonce = RandomNumberGenerator.GetBytes(16);
            _request = new Request(id, committed, nonce, PhoneName(model), now, now, null, [], Answer.Waiting);
            return new Begun(id, Convert.ToHexStringLower(nonce));
        }
    }

    /// <summary>Second step: the phone's random value, which must match its commitment. From here the dialog shows the number.</summary>
    public bool Reveal(string? id, string? nonce, string fingerprint, long now)
    {
        if (Bytes(nonce, 16) is not { } revealed || Bytes(fingerprint, 32) is not { } certificate) return false;
        lock (_lock)
        {
            if (Find(id, now) is not { Code: null, State: Answer.Waiting } request) return false;
            if (!CryptographicOperations.FixedTimeEquals(Commitment(revealed), request.Commit)) { _request = null; return false; }
            var code = Number(certificate, request.Nonce, revealed);
            _request = request with { SeenAt = now, Code = code, Choices = WithOthers(code) };
            return true;
        }
    }

    /// <summary>The phone waits for the answer. Allowed is given once: the caller hands out the key then.</summary>
    public Answer Poll(string? id, long now)
    {
        lock (_lock)
        {
            if (Find(id, now) is not { Code: not null } request) return Answer.Unknown;
            _request = request.State == Answer.Waiting ? request with { SeenAt = now } : null;
            return request.State;
        }
    }

    /// <summary>The phone's user cancelled.</summary>
    public void Withdraw(string? id, long now) { lock (_lock) if (Find(id, now) is not null) _request = null; }

    /// <summary>What the dialog shows: the phone that waits for an answer, with its number.</summary>
    public Shown? Pending(long now)
    {
        lock (_lock) return Current(now) is { Code: not null, State: Answer.Waiting } r ? new Shown(r.Id, r.Model, r.Choices) : null;
    }

    /// <summary>A number (or Refuse: no number) was pressed in the dialog (local requests only). Any other number refuses, for good.</summary>
    public bool Decide(string? id, string? code, long now)
    {
        lock (_lock)
        {
            if (Find(id, now) is not { Code: not null, State: Answer.Waiting } request) return false;
            _request = request with { State = code == request.Code ? Answer.Allowed : Answer.Denied, SeenAt = now };
            return _request.State == Answer.Allowed;
        }
    }

    private Request? Current(long now) =>
        Open(now) && _request is { } r && now - r.SeenAt <= SilenceMs && now - r.StartedAt <= RequestLifetimeMs ? r : _request = null;

    private Request? Find(string? id, long now) =>
        Current(now) is { } r && id is not null
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(id), Encoding.UTF8.GetBytes(r.Id)) ? r : null;

    internal static byte[] Commitment(byte[] phoneNonce) => Hash("phonedash-nearby-commit-1", phoneNonce);

    /// <summary>The number on both screens: "123 456". The phone computes the same from the certificate it sees.</summary>
    internal static string Number(byte[] fingerprint, byte[] pcNonce, byte[] phoneNonce)
    {
        var number = BinaryPrimitives.ReadUInt64BigEndian(Hash("phonedash-nearby-number-1", fingerprint, pcNonce, phoneNonce)) % 1_000_000;
        return $"{number / 1000:000} {number % 1000:000}";
    }

    /// <summary>The number among random ones, in random order.</summary>
    private static string[] WithOthers(string code)
    {
        var choices = new HashSet<string> { code };
        while (choices.Count < ChoiceCount)
        {
            var other = RandomNumberGenerator.GetInt32(1_000_000);
            choices.Add($"{other / 1000:000} {other % 1000:000}");
        }
        var shuffled = choices.ToArray();
        RandomNumberGenerator.Shuffle(shuffled.AsSpan());
        return shuffled;
    }

    private static byte[] Hash(string label, params byte[][] parts) =>
        SHA256.HashData([.. Encoding.ASCII.GetBytes(label), 0, .. parts.SelectMany(p => p)]);

    private static byte[]? Bytes(string? hex, int length)
    {
        if (hex is null || hex.Length != length * 2 || !hex.All(char.IsAsciiHexDigit)) return null;
        return Convert.FromHexString(hex);
    }

    internal static string PhoneName(string? model)
    {
        var name = new string((model ?? "").Where(c => c >= ' ' && c <= '~').Take(40).ToArray()).Trim();
        return name.Length > 0 ? name : "Android phone";
    }

    /// <summary>The body of a nearby request: anyone on the Wi-Fi can send one, so every bad body ends as null.</summary>
    internal static async Task<NearbyBody?> ReadBodyAsync(HttpRequest req)
    {
        if (req.ContentLength is > 1024) return null;
        try { return await req.ReadFromJsonAsync<NearbyBody>(); }
        catch (Exception e) when (e is System.Text.Json.JsonException or BadHttpRequestException or IOException or InvalidOperationException) { return null; }
    }
}

/// <summary>Body of POST /api/pair/nearby/*.</summary>
public sealed record NearbyBody(string? Id, string? Commit, string? Nonce);
