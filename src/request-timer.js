(function () {
  function isEnglish(language) {
    return language === "en";
  }

  function formatElapsedSeconds(elapsedMs, language = "zh-CN") {
    const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (isEnglish(language)) return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
    return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
  }

  function formatAiRequestStatus({ phase, elapsedMs, provider, url, model, language = "zh-CN" }) {
    const elapsed = formatElapsedSeconds(elapsedMs, language);
    if (isEnglish(language)) {
      if (phase === "done") return `Analysis complete. Duration: ${elapsed}`;
      return [
        "Analyzing...",
        `Elapsed: ${elapsed}`,
        `Provider: ${provider}`,
        `Endpoint: ${url}`,
        `Model: ${model}`
      ].join("\n");
    }

    if (phase === "done") return `分析完成，用时：${elapsed}`;
    return [
      "正在分析...",
      `已请求：${elapsed}`,
      `协议：${provider}`,
      `接口：${url}`,
      `模型：${model}`
    ].join("\n");
  }

  globalThis.requestTimer = { formatElapsedSeconds, formatAiRequestStatus };
}());
