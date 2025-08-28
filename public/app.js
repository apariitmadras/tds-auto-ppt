const form = document.getElementById("genForm");
const elText = document.getElementById("inputText");
const elGuidance = document.getElementById("guidance");
const elProvider = document.getElementById("provider");
const elApiKey = document.getElementById("apiKey");
const elTemplate = document.getElementById("template");
const elStatus = document.getElementById("status");
const elAlerts = document.getElementById("alerts");

function alert(msg) {
  elAlerts.innerHTML = `<div class="alert alert-danger alert-dismissible fade show" role="alert">
    ${msg}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  </div>`;
}

// Keep the key placeholder in sync with provider choice
function updateKeyPlaceholder() {
  const v = elProvider.value;
  elApiKey.placeholder =
    v === "openai"    ? "sk-..." :
    v === "anthropic" ? "anthropic-api-key" :
    v === "gemini"    ? "AIza..." :
                        "your API key";
}
updateKeyPlaceholder();
elProvider.addEventListener("change", updateKeyPlaceholder);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    elStatus.textContent = "Generating…";
    const fd = new FormData();
    fd.append("text", elText.value || "");
    fd.append("guidance", elGuidance.value || "");
    fd.append("provider", elProvider.value || "openai");
    if (elApiKey.value) fd.append("apiKey", elApiKey.value);
    if (!elTemplate.files[0]) throw new Error("Please choose a PPTX/POTX template.");
    fd.append("template", elTemplate.files[0]);

    const r = await fetch("/api/generate", { method: "POST", body: fd });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Generation failed: ${t}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated.pptx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    elStatus.textContent = "Done! Your download should start automatically.";
  } catch (err) {
    alert(err.message || "Error");
    elStatus.textContent = "";
  }
});
