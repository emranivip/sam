import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const decorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "عنوان جذاب ومختصر للاقتراح باللغة العربية",
    },
    roomType: {
      type: Type.STRING,
      description: "نوع الغرفة الظاهرة في الصورة مثل غرفة معيشة أو غرفة نوم أو مجلس",
    },
    styleName: {
      type: Type.STRING,
      description: "النمط التصميمي المقترح مثل حديث دافئ أو نيوكلاسيك أو بوهيمي",
    },
    summary: {
      type: Type.STRING,
      description: "تحليل معماري وجمالي مختصر للغرفة الحالية والإضاءة والمساحة في جملتين إلى ثلاث جمل",
    },
    budgetEstimate: {
      type: Type.STRING,
      description: "تقدير الميزانية المناسبة للتنفيذ بالعربية مثل اقتصادية أو متوسطة مع نطاق تقريبي",
    },
    colorPalette: {
      type: Type.ARRAY,
      description: "أربعة ألوان متناسقة مقترحة للغرفة",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "اسم اللون بالعربية" },
          hex: { type: Type.STRING, description: "كود اللون بصيغة HEX مثل #6C1BB0" },
          usage: { type: Type.STRING, description: "مكان استخدام اللون مثل الجدار الرئيسي أو الوسائد" },
        },
        required: ["name", "hex", "usage"],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      description: "أربع توصيات عملية تغطي ألوان الطلاء والأثاث والإضاءة والأرضيات",
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "واحد من: ألوان الطلاء، الأثاث، الإضاءة، الأرضيات",
          },
          title: { type: Type.STRING, description: "عنوان التوصية" },
          detail: { type: Type.STRING, description: "تفصيل عملي دقيق قابل للتنفيذ في هذه الغرفة" },
          priority: { type: Type.STRING, description: "أولوية التنفيذ: أساسي أو مكمّل" },
        },
        required: ["category", "title", "detail", "priority"],
      },
    },
    quickSteps: {
      type: Type.ARRAY,
      description: "ثلاث خطوات فورية مرتبة للبدء بتجديد الغرفة",
      items: { type: Type.STRING },
    },
  },
  required: [
    "title",
    "roomType",
    "styleName",
    "summary",
    "budgetEstimate",
    "colorPalette",
    "recommendations",
    "quickSteps",
  ],
};

function parseBase64Image(input: string, fallbackMime = "image/jpeg"): { mimeType: string; data: string } {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: fallbackMime, data: input };
}

function safeParseGeminiJson(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function handleGeminiError(error: unknown, res: express.Response) {
  const errObj = error as { status?: number; message?: string };
  const status = typeof errObj?.status === "number" ? errObj.status : 500;
  const rawMessage = errObj?.message || "حدث خطأ غير متوقع أثناء تحليل التصميم.";

  if (rawMessage.includes("GEMINI_API_KEY")) {
    return res.status(503).json({
      error: "مفتاح Gemini API غير مهيأ في إعدادات الخادم. يرجى إضافته من لوحة Settings > Secrets.",
    });
  }
  if (status === 403 || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return res.status(status).json({
      error: "تعذر التحقق من صلاحية مفتاح API. يرجى مراجعة المفتاح في Settings > Secrets.",
    });
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return res.status(429).json({
      error: "تم تجاوز حد الطلبات أو يلزم تفعيل الفوترة على مفتاح API لنماذج تعديل الصور في Settings > Secrets.",
    });
  }
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: "تعذر إتمام تحليل الديكور حالياً. يرجى المحاولة مجدداً.",
    details: rawMessage,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/decor/analyze", async (req, res) => {
    try {
      const { imageBase64, mimeType, category, notes, stylePreference, budgetLevel } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "يرجى إرفاق صورة للغرفة قبل طلب اقتراح الديكور." });
      }

      const parsed = parseBase64Image(imageBase64, typeof mimeType === "string" ? mimeType : "image/jpeg");
      const focusCategory = typeof category === "string" && category.trim() ? category.trim() : "عام";
      const userNotes = typeof notes === "string" && notes.trim() ? notes.trim() : "لا توجد ملاحظات إضافية";
      const preferredStyle =
        typeof stylePreference === "string" && stylePreference.trim() ? stylePreference.trim() : "متوازن وعصري دافئ";
      const preferredBudget =
        typeof budgetLevel === "string" && budgetLevel.trim() ? budgetLevel.trim() : "متوسطة";

      const ai = getGeminiClient();

      const prompt = `حلّل صورة هذه الغرفة بدقة وقدّم مقترح ديكور داخلي احترافي ومخصص لها باللغة العربية الفصحى الواضحة.
تركيز المستخدم الحالي: ${focusCategory}
النمط المفضل: ${preferredStyle}
مستوى الميزانية المطلوب: ${preferredBudget}
ملاحظات المستخدم: ${userNotes}

المطلوب:
- صف ما تراه فعلياً في الصورة (توزيع الأثاث، الإضاءة الطبيعية أو الصناعية، الجدران، والأرضيات) في حقل summary.
- اقترح لوحة ألوان متناسقة من 4 درجات بأكواد HEX دقيقة وصحيحة.
- قدّم 4 توصيات تغطي: "ألوان الطلاء"، "الأثاث"، "الإضاءة"، و"الأرضيات"، مع إعطاء أولوية وعمق أكبر لقسم "${focusCategory}" إذا كان محدداً.
- اقترح 3 خطوات فورية مرتبة للبدء بتجديد الغرفة.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction:
            "أنت مهندس ديكور داخلي خبير متخصص في تصميم المساحات السكنية العصرية والدافئة في العالم العربي. قدّم دائماً توصيات واقعية وعملية تناسب الصورة المرفقة فقط دون اختراع عناصر غير متوافقة مع بنية الغرفة.",
          responseMimeType: "application/json",
          responseSchema: decorResponseSchema,
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({ error: "لم يرجع الذكاء الاصطناعي نتيجة صالحة، يرجى إعادة المحاولة." });
      }

      const proposal = safeParseGeminiJson(rawText);
      return res.json({ proposal });
    } catch (error) {
      console.error("Error in /api/decor/analyze:", error);
      return handleGeminiError(error, res);
    }
  });

  app.post("/api/decor/refine", async (req, res) => {
    try {
      const { currentProposal, refinementPrompt, imageBase64, mimeType } = req.body ?? {};

      if (!currentProposal || typeof refinementPrompt !== "string" || !refinementPrompt.trim()) {
        return res.status(400).json({ error: "يرجى كتابة التعديل المطلوب على التصميم." });
      }

      const ai = getGeminiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (typeof imageBase64 === "string" && imageBase64.length > 0) {
        const parsed = parseBase64Image(imageBase64, typeof mimeType === "string" ? mimeType : "image/jpeg");
        parts.push({
          inlineData: {
            mimeType: parsed.mimeType,
            data: parsed.data,
          },
        });
      }

      parts.push({
        text: `لديك مقترح الديكور التالي بصيغة JSON:
${JSON.stringify(currentProposal)}

طلب المستخدم التعديل التالي عليه: "${refinementPrompt.trim()}"

قم بتحديث المقترح ليحقق طلب المستخدم بدقة مع الحفاظ على تناسق باقي العناصر، وأرجع النتيجة كاملة بنفس بنية JSON المطلوبة وباللغة العربية.`,
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          systemInstruction:
            "أنت مهندس ديكور داخلي تعدّل مقترح تصميم قائم بناءً على رغبة العميل، مع الحفاظ على الانسجام اللوني والعملي.",
          responseMimeType: "application/json",
          responseSchema: decorResponseSchema,
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({ error: "تعذر تحديث المقترح، يرجى المحاولة مرة أخرى." });
      }

      const proposal = safeParseGeminiJson(rawText);
      return res.json({ proposal });
    } catch (error) {
      console.error("Error in /api/decor/refine:", error);
      return handleGeminiError(error, res);
    }
  });

  app.post("/api/decor/visualize", async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType,
        proposal,
        category,
        notes,
        stylePreference,
        customPrompt,
        aspectRatio,
      } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "يرجى إرفاق صورة للغرفة قبل توليد التعديل البصري." });
      }

      const parsed = parseBase64Image(imageBase64, typeof mimeType === "string" ? mimeType : "image/jpeg");
      const allowedRatios = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);
      const targetRatio = typeof aspectRatio === "string" && allowedRatios.has(aspectRatio) ? aspectRatio : "16:9";

      const ai = getGeminiClient();

      const paletteSummary = Array.isArray(proposal?.colorPalette)
        ? proposal.colorPalette
            .slice(0, 4)
            .map((c: { name?: string; hex?: string; usage?: string }) =>
              `${c.name ?? ""} (${c.hex ?? ""}) for ${c.usage ?? ""}`.trim()
            )
            .join(", ")
        : "";

      const recSummary = Array.isArray(proposal?.recommendations)
        ? proposal.recommendations
            .slice(0, 4)
            .map((r: { category?: string; title?: string; detail?: string }) =>
              `${r.category ?? ""}: ${r.title ?? ""} - ${r.detail ?? ""}`.trim()
            )
            .join(" | ")
        : "";

      const focusCategory = typeof category === "string" && category.trim() ? category.trim() : "عام";
      const preferredStyle =
        typeof stylePreference === "string" && stylePreference.trim() ? stylePreference.trim() : "حديث دافئ";
      const userNotes = typeof notes === "string" && notes.trim() ? notes.trim() : "";

      const baseArchitectureConstraint =
        "Edit this exact room photograph realistically while strictly preserving the exact camera angle, room geometry, walls, windows, doors, ceiling height, and perspective. Photorealistic interior design photography, natural shadows, no text or watermarks.";

      const editTasks: Array<{ id: string; label: string; description: string; prompt: string }> =
        typeof customPrompt === "string" && customPrompt.trim()
          ? [
              {
                id: `custom-${Date.now()}`,
                label: "تعديل مخصص",
                description: customPrompt.trim(),
                prompt: `${baseArchitectureConstraint} Apply this exact interior design modification to the room: ${customPrompt.trim()}. Keep surrounding untouched elements coherent and realistic. Focus area: ${focusCategory}.`,
              },
            ]
          : [
              {
                id: "proposal-exact",
                label: "التصور المقترح",
                description: proposal?.styleName
                  ? `تطبيق مقترح ${proposal.styleName} مع لوحة الألوان الموصى بها`
                  : "تطبيق توصيات الديكور المقترحة مباشرة على الغرفة",
                prompt: `${baseArchitectureConstraint} Redesign and restyle this room following style "${proposal?.styleName || preferredStyle}" with focus on "${focusCategory}". ${paletteSummary ? `Use this color palette: ${paletteSummary}.` : ""} ${recSummary ? `Design updates: ${recSummary}.` : ""} ${userNotes ? `User preferences: ${userNotes}.` : ""}`,
              },
              {
                id: "airy-bright",
                label: "إشراقة عصرية فاتحة",
                description: "درجات محايدة مشرقة وإضاءة نهارية ناعمة تمنح اتساعاً",
                prompt: `${baseArchitectureConstraint} Restyle this room in a bright, airy contemporary style with warm off-white and soft sand wall tones, light oak wood textures, soft linen upholstery, layered warm-white recessed and pendant lighting, and subtle indoor greenery. Focus area: ${focusCategory}. ${userNotes ? `User preferences: ${userNotes}.` : ""}`,
              },
              {
                id: "warm-luxury",
                label: "دفء فاخر وأنيق",
                description: "تباين دافئ مع إضاءة مخفية ولمسات نحاسية وخشبية فاخرة",
                prompt: `${baseArchitectureConstraint} Restyle this room in an inviting warm luxury modern style with rich warm neutral walls, walnut wood accents, textured bouclé and velvet fabrics, warm 2700K indirect cove and accent lamp lighting, and tasteful brushed brass decor details. Focus area: ${focusCategory}. ${userNotes ? `User preferences: ${userNotes}.` : ""}`,
              },
            ];

      const results = await Promise.allSettled(
        editTasks.map(async (task) => {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-image",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: parsed.mimeType,
                    data: parsed.data,
                  },
                },
                { text: task.prompt },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio: targetRatio,
              },
            },
          });

          let imageDataUrl = "";
          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType ?? "image/png";
              imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
              break;
            }
          }

          if (!imageDataUrl) {
            throw new Error("لم يرجع نموذج الصور صورة معدلة.");
          }

          return {
            id: task.id,
            label: task.label,
            description: task.description,
            imageDataUrl,
          };
        })
      );

      const options = results
        .filter((r): r is PromiseFulfilledResult<{ id: string; label: string; description: string; imageDataUrl: string }> => r.status === "fulfilled")
        .map((r) => r.value);

      if (options.length === 0) {
        const firstRejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
        if (firstRejected) {
          throw firstRejected.reason;
        }
        return res.status(502).json({ error: "لم يتمكن نموذج الصور من إنشاء تعديلات بصرية لهذه الصورة." });
      }

      return res.json({ options });
    } catch (error) {
      console.error("Error in /api/decor/visualize:", error);
      return handleGeminiError(error, res);
    }
  });

  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "نقطة النهاية المطلوبة غير موجودة." });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.path.startsWith("/api/")) {
      return next(err);
    }
    const errObj = err as { type?: string; status?: number; message?: string };
    if (errObj?.type === "entity.too.large" || errObj?.status === 413) {
      return res.status(413).json({
        error: "حجم الصورة المرفقة كبير جداً. يرجى اختيار صورة أصغر والمحاولة مجدداً.",
      });
    }
    if (err instanceof SyntaxError && errObj?.status === 400) {
      return res.status(400).json({
        error: "بيانات الطلب غير صالحة.",
      });
    }
    return res.status(errObj?.status && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 500).json({
      error: "حدث خطأ غير متوقع في الخادم. يرجى المحاولة مرة أخرى.",
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      plugins:
        process.env.DISABLE_HMR === "true"
          ? [
              {
                name: "disable-vite-client-ws",
                enforce: "post",
                transform(code, id) {
                  if (id.endsWith("/@vite/client") || id.endsWith("/vite/dist/client/client.mjs")) {
                    return code
                      .replace(
                        "transport.connect(createHMRHandler(handleMessage));",
                        "/* HMR disabled: WebSocket connection skipped */"
                      )
                      .replace(
                        'else throw new SendBeforeConnectError("send was called before connect");',
                        "else return;"
                      )
                      .replace(
                        'else throw new SendBeforeConnectError("invoke was called before connect");',
                        "else return;"
                      );
                  }
                },
              },
            ]
          : [],
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
