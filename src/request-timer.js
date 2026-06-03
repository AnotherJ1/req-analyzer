(function () {
  function formatElapsedSeconds(elapsedMs) {
    const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes) return `${minutes} ${t("minutes")} ${seconds} ${t("seconds")}`;
    return `${seconds} ${t("seconds")}`;
  }

  function formatAiRequestStatus({ phase, elapsedMs, url, model }) {
    const elapsed = formatElapsedSeconds(elapsedMs);
    if (phase === "done") return `${t("analysisComplete")} ${elapsed}`;
    return `${formatMessage(t("analysisSending"), { url, model })}\n${t("elapsed")}: ${elapsed}`;
  }

  globalThis.requestTimer = { formatElapsedSeconds, formatAiRequestStatus };
}());
