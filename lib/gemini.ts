import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export async function convertFileToCsv(base64Data: string, mimeType: string): Promise<string> {
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const isImage = (mimeType || '').startsWith('image/');
  const fileTypeLabel = isImage ? 'esta imagem' : 'este documento PDF';

  const prompt = `
    Extraia todos os dados tabulares de ${fileTypeLabel} e converta para o formato CSV seguindo o padrão brasileiro.
    REGRAS OBRIGATÓRIAS:
    1. Use PONTO E VÍRGULA (;) como delimitador/separador de colunas.
    2. Use VÍRGULA (,) como separador decimal (ex: 1234,56).
    3. Formate TODAS as datas como DD/MM/AAAA (ex: 26/02/2026).
    4. Coloque TODOS os valores entre aspas duplas (ex: "valor1";"valor2").
    5. Não inclua explicações ou textos adicionais, retorne APENAS o conteúdo do CSV.
    6. Se houver múltiplas tabelas, consolide-as se fizerem sentido juntas.
    7. A primeira linha deve ser obrigatoriamente o cabeçalho.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
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
    });

    const text = response.text || "";
    // Clean up markdown code blocks if present
    return text.replace(/```csv\n?|```/g, "").trim();
  } catch (error) {
    console.error("Error converting file to CSV:", error);
    throw new Error(`Falha ao processar ${isImage ? 'a imagem' : 'o PDF'} com IA.`);
  }
}
