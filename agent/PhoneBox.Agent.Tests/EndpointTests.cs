using PhoneBox.Agent;
using Xunit;

public sealed class EndpointTests
{
    [Fact]
    public void DefaultsAndIsolatedInstancesHaveDistinctUrlsAndMutexes()
    {
        var standard = AgentEndpoint.FromArgs([]);
        var isolated = AgentEndpoint.FromArgs(["--config", "test.json", "--port", "18775"]);
        Assert.Equal(8775, standard.Port);
        Assert.Equal(@"Local\PhoneDash.Agent", standard.MutexName);
        Assert.Equal("http://127.0.0.1:18775/", isolated.SettingsUrl);
        Assert.NotEqual(standard.MutexName, isolated.MutexName);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("65536")]
    [InlineData("not-a-port")]
    [InlineData("8775; command")]
    public void InvalidPortsAreRejected(string value) => Assert.Throws<ArgumentException>(() => AgentEndpoint.FromArgs(["--port", value]));

    [Fact]
    public void MissingAndRepeatedPortsAreRejected()
    {
        Assert.Throws<ArgumentException>(() => AgentEndpoint.FromArgs(["--port"]));
        Assert.Throws<ArgumentException>(() => AgentEndpoint.FromArgs(["--port", "18775", "--port", "18776"]));
    }

    [Fact]
    public void RestartPreservesTheConfigPathAndPortAsSeparateArguments()
    {
        var info = AppRestart.StartInfo("PhoneDashAgent.exe", ["--config", "C:/test folder/config.json", "--port", "18775", "--restart"]);
        Assert.Equal(new[] { "--config", "C:/test folder/config.json", "--port", "18775", "--restart" }, info.ArgumentList);
        Assert.False(info.UseShellExecute);
        var hosted = AppRestart.StartInfo("dotnet", ["--port", "18775"]);
        Assert.EndsWith("PhoneDashAgent.dll", hosted.ArgumentList[0]);
    }
}
