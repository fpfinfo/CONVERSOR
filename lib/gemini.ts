import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export async function convertPdfToCsv(base64Data: string, mimeType: string): Promise<string> {
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `
    Extraia todos os dados tabulares deste documento PDF e converta para o formato CSV.
    REGRAS IMPORTANTES:
    1. Use vírgula (,) como separador.
    2. Coloque TODOS os valores entre aspas duplas (ex: "valor1","valor2").
    3. Não inclua explicações, apenas o conteúdo do CSV.
    4. Se houver múltiplas tabelas, tente consolidá-las se fizerem sentido juntas, ou extraia a principal.
    5. Certifique-se de que a primeira linha seja o cabeçalho.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    // Clean up markdown code blocks if present
    return text.replace(/```csv\n?|```/g, "").trim();
  } catch (error) {
    console.error("Error converting PDF to CSV:", error);
    throw new Error("Falha ao processar o PDF com IA.");
  }
}
