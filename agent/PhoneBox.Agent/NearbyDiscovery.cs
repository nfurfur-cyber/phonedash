using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PhoneBox.Agent;

/// <summary>
/// Answers phones on the same Wi-Fi that look for this computer: a broadcast question on UDP 8776, answered with the
/// computer's name, Wi-Fi port and certificate fingerprint. Only while the pairing dialog is open, only to private
/// addresses, and never with more bytes than the question had (no use for amplification). The answer proves nothing;
/// <see cref="NearbyPairing"/> does the proving.
/// </summary>
public sealed partial class NearbyDiscovery(NearbyPairing nearby, ConfigStore cfg, NearbyIdentity identity, ILogger<NearbyDiscovery> log) : BackgroundService
{
    public const int Port = 8776;
    /// <summary>A question is padded to this size, so an answer is always smaller.</summary>
    internal const int QuestionBytes = 400;
    private const int AnswersPerSecond = 20;

    private long _second;
    private int _answered;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (identity.Fingerprint is null) return; // Wi-Fi is off
        using var socket = new UdpClient(AddressFamily.InterNetwork);
        try { socket.Client.Bind(new IPEndPoint(IPAddress.Any, Port)); }
        catch (SocketException e)
        {
            log.LogWarning("phones on this Wi-Fi cannot find this computer by themselves: UDP {Port} is taken ({Message})", Port, e.Message);
            return;
        }
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var question = await socket.ReceiveAsync(ct);
                if (Reply(question.Buffer, question.RemoteEndPoint.Address, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) is { } answer)
                    await socket.SendAsync(answer, question.RemoteEndPoint, ct);
            }
            catch (OperationCanceledException) { return; }
            // Windows reports "port unreachable" from an earlier answer as an error of the next receive
            catch (SocketException) { await Task.Delay(100, ct).ContinueWith(static _ => { }, TaskScheduler.Default); }
        }
    }

    internal byte[]? Reply(byte[] question, IPAddress from, long now)
    {
        if (!nearby.IsOpen(now) || !cfg.Get().Lan.Enabled || !IsPrivate(from) || ReadNonce(question) is not { } nonce) return null;
        if (_second != now / 1000) (_second, _answered) = (now / 1000, 0);
        if (++_answered > AnswersPerSecond) return null;
        var answer = JsonSerializer.SerializeToUtf8Bytes(new { v = 1, nonce, pc = identity.Pc, port = identity.Port, fp = identity.Fingerprint });
        return answer.Length <= question.Length ? answer : null;
    }

    /// <summary>"PHONEDASH? 1 &lt;16 hex digits&gt;" and spaces up to <see cref="QuestionBytes"/>.</summary>
    internal static string? ReadNonce(byte[] question)
    {
        if (question.Length is < QuestionBytes or > 1024) return null;
        return Question().Match(Encoding.ASCII.GetString(question)) is { Success: true } m ? m.Groups[1].Value : null;
    }

    internal static bool IsPrivate(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != AddressFamily.InterNetwork) return false;
        var b = address.GetAddressBytes();
        return b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168);
    }

    [GeneratedRegex(@"\APHONEDASH\? 1 ([0-9a-f]{16}) *\z")]
    private static partial Regex Question();
}

/// <summary>Who this computer is on the Wi-Fi; no fingerprint while Wi-Fi is off.</summary>
public sealed record NearbyIdentity(string Pc, int Port, string? Fingerprint);
