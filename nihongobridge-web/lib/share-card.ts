import type { ResultPageData } from "@/types/results";

export async function createResultShareImage(data: ResultPageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1_200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  context.fillStyle = "#FAFAF7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(28,28,30,.025)";
  for (let y = 12; y < 630; y += 18) {
    for (let x = (y / 18) % 2 ? 12 : 21; x < 1_200; x += 18) {
      context.beginPath();
      context.arc(x, y, 1, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.fillStyle = "#C0392B";
  context.beginPath();
  context.arc(128, 118, 58, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = "700 34px Inter, sans-serif";
  context.textAlign = "center";
  context.fillText(data.level, 128, 130);

  context.textAlign = "left";
  context.fillStyle = "#1C1C1E";
  context.font = "700 30px Inter, sans-serif";
  context.fillText("NihongoBridge", 220, 100);
  context.font = "500 20px Inter, sans-serif";
  context.fillStyle = "rgba(28,28,30,.58)";
  context.fillText("JLPT practice result", 220, 136);

  const maxScore = data.testType === "full_mock" ? 180 : 60;
  context.fillStyle = "#1C1C1E";
  context.font = "800 100px Inter, sans-serif";
  context.fillText(String(data.result.score_total), 72, 300);
  context.font = "600 34px Inter, sans-serif";
  context.fillStyle = "rgba(28,28,30,.42)";
  context.fillText(`/ ${maxScore}`, 270, 300);
  context.font = "700 24px Inter, sans-serif";
  context.fillStyle = data.result.passed ? "#4D6B57" : "#B42318";
  context.fillText(data.result.passed ? "PASS · 合格" : "KEEP GOING · もう一度", 76, 350);

  const sections = [
    ["Vocabulary", data.result.score_by_section.vocabulary.score],
    ["Grammar + Reading", data.result.score_by_section.grammar_reading.score],
    ["Listening", data.result.score_by_section.listening.score],
  ] as const;
  sections.forEach(([label, score], index) => {
    const y = 440 + index * 52;
    context.fillStyle = "rgba(28,28,30,.56)";
    context.font = "600 18px Inter, sans-serif";
    context.fillText(label, 76, y);
    context.fillStyle = "rgba(28,28,30,.09)";
    roundRect(context, 300, y - 17, 650, 14, 7);
    context.fill();
    context.fillStyle = "#C0392B";
    roundRect(context, 300, y - 17, (650 * score) / 60, 14, 7);
    context.fill();
    context.fillStyle = "#1C1C1E";
    context.font = "700 18px Inter, sans-serif";
    context.fillText(`${score}/60`, 980, y);
  });

  context.fillStyle = "rgba(28,28,30,.45)";
  context.font = "500 16px Inter, sans-serif";
  context.fillText(`${data.result.accuracy}% accuracy · +${data.result.xp_earned} XP`, 860, 596);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the share image"))),
      "image/png",
      0.95,
    );
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
