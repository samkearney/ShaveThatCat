const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;

// Elements
const dropZone = $<HTMLDivElement>("#drop-zone");
const fileInput = $<HTMLInputElement>("#file-input");
const preview = $<HTMLImageElement>("#preview");
const clearBtn = $<HTMLButtonElement>("#clear-btn");
const shaveBtn = $<HTMLButtonElement>("#shave-btn");
const uploadSection = $<HTMLElement>("#upload-section");
const loadingSection = $<HTMLElement>("#loading-section");
const loadingMsg = $<HTMLParagraphElement>("#loading-msg");
const resultSection = $<HTMLElement>("#result-section");
const beforeImg = $<HTMLImageElement>("#before-img");
const afterImg = $<HTMLImageElement>("#after-img");
const downloadBtn = $<HTMLButtonElement>("#download-btn");
const anotherBtn = $<HTMLButtonElement>("#another-btn");
const errorSection = $<HTMLElement>("#error-section");
const errorMsg = $<HTMLParagraphElement>("#error-msg");
const retryBtn = $<HTMLButtonElement>("#retry-btn");
const remainingEl = $<HTMLSpanElement>("#remaining");

const LOADING_MESSAGES = [
  "Warming up the clippers...",
  "Applying shaving cream...",
  "Finding the right razor...",
  "Carefully trimming the whiskers... just kidding, keeping those.",
  "Buffing that beautiful bald head...",
  "Almost done, just a few more patches...",
  "Your cat is being very brave...",
  "Sweeping up the fur...",
];

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

let selectedFile: File | null = null;
let resizedBlob: Blob | null = null;
let detectedSize: ImageSize = "1024x1024";
let loadingInterval: ReturnType<typeof setInterval> | null = null;
let isShaving = false;

// --- Status ---
async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    const data = (await res.json()) as { remaining: number; total: number };
    remainingEl.textContent = String(data.remaining);
  } catch {
    remainingEl.textContent = "?";
  }
}

// --- Image Resize ---
function detectSize(width: number, height: number): ImageSize {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024"; // Landscape
  if (ratio < 0.8) return "1024x1536"; // Portrait
  return "1024x1024"; // Square
}

function resizeImage(file: File, maxDim: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      detectedSize = detectSize(width, height);
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// --- File Handling ---
async function handleFile(file: File) {
  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    showError("Please upload a PNG, JPEG, or WebP image.");
    return;
  }

  selectedFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result as string;
    preview.hidden = false;
    clearBtn.hidden = false;
    dropZone.querySelector<HTMLDivElement>(".drop-zone-content")!.hidden = true;
    shaveBtn.disabled = false;
  };
  reader.readAsDataURL(file);

  // Resize in background
  try {
    resizedBlob = await resizeImage(file, 1024);
  } catch (err) {
    resizedBlob = null; // Fall back to original
    console.error("[shave] resize failed:", err);
  }

  // Check size after resize (original file used as fallback if resize failed)
  const finalSize = resizedBlob ? resizedBlob.size : file.size;
  if (finalSize > 10 * 1024 * 1024) {
    showError(
      `Image too large (${(finalSize / 1024 / 1024).toFixed(1)}MB after resize). ` +
      `Original: ${(file.size / 1024 / 1024).toFixed(1)}MB ${file.type}. ` +
      `Resize ${resizedBlob ? "succeeded" : "failed"}.`
    );
    clearFile();
    return;
  }
}

function clearFile() {
  selectedFile = null;
  resizedBlob = null;
  preview.hidden = true;
  preview.src = "";
  clearBtn.hidden = true;
  dropZone.querySelector<HTMLDivElement>(".drop-zone-content")!.hidden = false;
  shaveBtn.disabled = true;
  fileInput.value = "";
}

// --- Loading Messages ---
function startLoadingMessages() {
  let idx = 0;
  loadingMsg.textContent = LOADING_MESSAGES[0];
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % LOADING_MESSAGES.length;
    loadingMsg.textContent = LOADING_MESSAGES[idx];
  }, 3000);
}

function stopLoadingMessages() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

// --- Section Visibility ---
function showSection(section: "upload" | "loading" | "result" | "error") {
  uploadSection.hidden = section !== "upload";
  loadingSection.hidden = section !== "loading";
  resultSection.hidden = section !== "result";
  errorSection.hidden = section !== "error";
}

function showError(msg: string) {
  errorMsg.textContent = msg;
  showSection("error");
  stopLoadingMessages();
}

// --- Shave! ---
async function shave() {
  if (!selectedFile || isShaving) return;
  isShaving = true;

  showSection("loading");
  startLoadingMessages();

  const blob = resizedBlob || selectedFile;
  const formData = new FormData();
  formData.append("image", blob, "cat.jpg");
  formData.append("size", detectedSize);

  try {
    const res = await fetch("/api/shave", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as {
      image?: string;
      error?: string;
      remaining?: number;
    };

    if (!res.ok || data.error) {
      showError(data.error || "Something went wrong. Please try again.");
      return;
    }

    // Show result
    stopLoadingMessages();
    beforeImg.src = preview.src;
    afterImg.src = data.image!;
    if (data.remaining !== undefined) {
      remainingEl.textContent = String(data.remaining);
    }
    showSection("result");
  } catch {
    showError("Network error. Please check your connection and try again.");
  } finally {
    isShaving = false;
  }
}

// --- Download ---
function downloadResult() {
  const link = document.createElement("a");
  link.href = afterImg.src;
  link.download = "shaved-cat.png";
  link.click();
}

// --- Event Listeners ---

// Drag and drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});

// File input
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

// Click drop zone to open file picker (but not when clicking on the file label/button)
dropZone.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (
    !target.closest(".file-btn") &&
    !target.closest(".clear-btn") &&
    preview.hidden
  ) {
    fileInput.click();
  }
});

// Buttons
clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearFile();
});

shaveBtn.addEventListener("click", shave);
downloadBtn.addEventListener("click", downloadResult);

anotherBtn.addEventListener("click", () => {
  clearFile();
  showSection("upload");
});

retryBtn.addEventListener("click", () => {
  if (selectedFile) {
    showSection("upload");
  } else {
    clearFile();
    showSection("upload");
  }
});

// Init
fetchStatus();
