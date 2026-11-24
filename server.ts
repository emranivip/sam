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

  type ImageProviderId = "icbinp" | "dreamshaper" | "deliberate" | "flux-schnell";

  function getImageProviders() {
    return [
      {
        id: "icbinp" as const,
        name: "ICBINP Photoreal",
        subtitle: "تصوير واقعي وتعديل الغرفة (مفتوح المصدر · مجاني)",
        supportsPhotoEdit: true,
        configured: true,
        secretName: "",
      },
      {
        id: "dreamshaper" as const,
        name: "DreamShaper",
        subtitle: "تصميم عصري دافئ وإضاءة فنية (مفتوح المصدر · مجاني)",
        supportsPhotoEdit: true,
        configured: true,
        secretName: "",
      },
      {
        id: "deliberate" as const,
        name: "Deliberate 3.0",
        subtitle: "تفاصيل معمارية دقيقة وأثاث متناسق (مفتوح المصدر)",
        supportsPhotoEdit: true,
        configured: true,
        secretName: "",
      },
      {
        id: "flux-schnell" as const,
        name: "FLUX.1 Schnell",
        subtitle: "توليد سريع Apache 2.0 مع مسار احتياطي بلا حدود",
        supportsPhotoEdit: false,
        configured: true,
        secretName: "",
      },
    ];
  }

  async function fetchTrustedImageAsDataUrl(rawUrl: string, allowedHostSuffixes: string[]): Promise<string> {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new Error("رابط الصورة غير آمن.");
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    ) {
      throw new Error("مصدر الصورة غير مصرح به.");
    }
    const isAllowed = allowedHostSuffixes.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
    if (!isAllowed) {
      throw new Error("مصدر الصورة غير مصرح به.");
    }
    const imgResp = await fetch(parsedUrl.toString(), { signal: AbortSignal.timeout(20000) });
    if (!imgResp.ok) {
      throw new Error("تعذر تنزيل الصورة المولّدة.");
    }
    const contentType = (imgResp.headers.get("content-type") || "image/png").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error("الاستجابة المستلمة ليست صورة صالحة.");
    }
    const arrayBuf = await imgResp.arrayBuffer();
    if (arrayBuf.byteLength === 0) {
      throw new Error("الصورة المستلمة فارغة.");
    }
    return `data:${contentType};base64,${Buffer.from(arrayBuf).toString("base64")}`;
  }

  function translateArabicDecorKeywords(text: string): string {
    if (!text) return "";
    const glossary: Array<[RegExp, string]> = [
      [/غرفة معيشة|صالة/g, "living room"],
      [/غرفة نوم/g, "bedroom"],
      [/مجلس/g, "luxury majlis lounge"],
      [/مطبخ/g, "modern kitchen"],
      [/حمام/g, "modern bathroom"],
      [/مكتب/g, "home office"],
      [/ألوان الطلاء|طلاء|جدران|حوائط/g, "painted walls"],
      [/الأثاث|أثاث|أريكة|كنب/g, "modern sofa and furniture"],
      [/الإضاءة|إضاءة مخفية|إضاءة|مصابيح/g, "warm indirect recessed cove lighting and accent lamps"],
      [/الأرضيات|أرضيات|سجاد|باركيه|رخام/g, "wood parquet flooring and textured woven rug"],
      [/بيج رملي|بيج|رملي/g, "warm sand beige"],
      [/أبيض/g, "warm off-white"],
      [/رمادي/g, "soft neutral grey"],
      [/أخضر|زيتوني/g, "sage olive green"],
      [/خشب|خشبية/g, "natural oak and walnut wood accents"],
      [/نحاس|ذهبي/g, "brushed brass details"],
      [/نباتات/g, "indoor potted plants"],
      [/حديث دافئ|حديث|عصري/g, "warm contemporary modern"],
      [/بوهيمي/g, "bohemian warm natural"],
      [/نيوكلاسيك/g, "neoclassical elegant"],
      [/مينيمال|بسيط/g, "minimalist clean"],
      [/فاخر/g, "inviting luxury"],
      [/فاتحة|مشرقة/g, "bright airy sunlit"],
      [/دافئة|دافئ/g, "cozy warm"],
    ];

    let mapped = text;
    for (const [pattern, replacement] of glossary) {
      mapped = mapped.replace(pattern, ` ${replacement} `);
    }
    return mapped.replace(/\s+/g, " ").trim();
  }

  function getAiHordeDimensions(targetRatio: string): { width: number; height: number } {
    switch (targetRatio) {
      case "1:1":
        return { width: 512, height: 512 };
      case "3:4":
      case "9:16":
        return { width: 448, height: 640 };
      case "4:3":
      case "16:9":
      default:
        return { width: 640, height: 448 };
    }
  }

  async function generateWithAiHorde(
    prompt: string,
    models: string[],
    parsedImage: { mimeType: string; data: string } | null,
    targetRatio: string,
    steps = 20
  ): Promise<string> {
    const apiKey = process.env.AI_HORDE_API_KEY?.trim() || "0000000000";
    const { width, height } = getAiHordeDimensions(targetRatio);
    const cleanPrompt = prompt.slice(0, 750);
    const negativePrompt =
      "text, watermark, logo, signature, blurry, low quality, distorted geometry, warped walls, cartoon, cgi artifact";

    const requestBody: Record<string, unknown> = {
      prompt: `${cleanPrompt} ### ${negativePrompt}`,
      params: {
        sampler_name: "k_euler_a",
        width,
        height,
        steps,
        cfg_scale: 7,
        n: 1,
        ...(parsedImage ? { denoising_strength: 0.62 } : {}),
      },
      models,
      r2: true,
      nsfw: false,
      censor_nsfw: true,
    };

    if (parsedImage) {
      requestBody.source_image = parsedImage.data;
      requestBody.source_processing = "img2img";
    }

    const submitResp = await fetch("https://aihorde.net/api/v2/generate/async", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        "Client-Agent": "manzel-alafkar:1.0:open-source-decor",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    const submitJson = (await submitResp.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      rc?: string;
    };

    if (!submitResp.ok || !submitJson.id) {
      const err = new Error(submitJson.message || `AI Horde submit error ${submitResp.status}`) as Error & {
        status?: number;
      };
      err.status = submitResp.status >= 400 ? submitResp.status : 502;
      throw err;
    }

    const jobId = submitJson.id;
    const deadline = Date.now() + 55000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const checkResp = await fetch(`https://aihorde.net/api/v2/generate/check/${encodeURIComponent(jobId)}`, {
        headers: { "Client-Agent": "manzel-alafkar:1.0:open-source-decor" },
        signal: AbortSignal.timeout(10000),
      });
      if (!checkResp.ok) {
        continue;
      }
      const checkJson = (await checkResp.json().catch(() => ({}))) as {
        done?: boolean;
        faulted?: boolean;
        is_possible?: boolean;
      };
      if (checkJson.faulted || checkJson.is_possible === false) {
        throw new Error("AI_HORDE_UNAVAILABLE");
      }
      if (checkJson.done) {
        break;
      }
    }

    const statusResp = await fetch(`https://aihorde.net/api/v2/generate/status/${encodeURIComponent(jobId)}`, {
      headers: { "Client-Agent": "manzel-alafkar:1.0:open-source-decor" },
      signal: AbortSignal.timeout(15000),
    });

    const statusJson = (await statusResp.json().catch(() => ({}))) as {
      done?: boolean;
      generations?: Array<{ img?: string }>;
    };

    const imgOutput = statusJson.generations?.[0]?.img;
    if (!statusJson.done || !imgOutput) {
      throw new Error("استغرق توليد الصورة عبر الشبكة المفتوحة وقتاً أطول من المعتاد، يرجى المحاولة مجدداً.");
    }

    if (imgOutput.startsWith("https://")) {
      return fetchTrustedImageAsDataUrl(imgOutput, ["r2.cloudflarestorage.com", "aihorde.net", "stablehorde.net"]);
    }
    return `data:image/webp;base64,${imgOutput}`;
  }

  async function generateWithFluxSchnellOpen(
    prompt: string,
    parsedImage: { mimeType: string; data: string } | null,
    targetRatio: string
  ): Promise<string> {
    // 1) Try official Apache 2.0 FLUX.1-schnell public Gradio Space (fast when ZeroGPU quota is free)
    try {
      const submitResp = await fetch("https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [prompt.slice(0, 600), 0, true, 768, 512, 4],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (submitResp.ok) {
        const submitData = (await submitResp.json().catch(() => ({}))) as { event_id?: string };
        if (submitData.event_id) {
          const sseResp = await fetch(
            `https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer/${encodeURIComponent(submitData.event_id)}`,
            { signal: AbortSignal.timeout(18000) }
          );
          if (sseResp.ok) {
            const sseText = await sseResp.text();
            if (sseText.includes("event: complete")) {
              const urlMatch = sseText.match(/https:\/\/black-forest-labs-flux-1-schnell\.hf\.space\/gradio_api\/file=[^"\s]+/);
              if (urlMatch?.[0]) {
                return await fetchTrustedImageAsDataUrl(urlMatch[0], ["black-forest-labs-flux-1-schnell.hf.space"]);
              }
            }
          }
        }
      }
    } catch {
      // Fall through silently to unlimited open-source routes
    }

    // 2) Try Pollinations open-source FLUX endpoint (free tier: 1 req / 45s per IP)
    try {
      const polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 400))}?model=flux&width=768&height=512&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
      return await fetchTrustedImageAsDataUrl(polUrl, ["image.pollinations.ai"]);
    } catch {
      // Fall through silently to unlimited AI Horde open-source cluster
    }

    // 3) Guaranteed unlimited open-source AI Horde fallback
    try {
      return await generateWithAiHorde(
        prompt,
        ["Flux.1-Schnell fp8 (Compact)", "Z-Image-Turbo", "ICBINP - I Can't Believe It's Not Photography", "Dreamshaper"],
        parsedImage,
        targetRatio,
        16
      );
    } catch {
      return await generateWithAiHorde(
        prompt,
        ["ICBINP - I Can't Believe It's Not Photography", "Dreamshaper", "Deliberate", "Realistic Vision"],
        parsedImage,
        targetRatio,
        18
      );
    }
  }

  function handleImageProviderError(error: unknown, provider: ImageProviderId, res: express.Response) {
    const errObj = error as { status?: number; message?: string };
    const status = typeof errObj?.status === "number" ? errObj.status : 502;
    const msg = errObj?.message || "تعذر توليد الصورة حالياً.";

    if (status === 429) {
      return res.status(429).json({
        error: "الطلب مزدحم لحظياً على الشبكة المجانية المفتوحة، أعد المحاولة بعد ثوانٍ قليلة.",
      });
    }
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      error: `تعذر توليد الصورة عبر ${provider}: ${msg}`,
    });
  }

  app.get("/api/decor/providers", (_req, res) => {
    res.json({ providers: getImageProviders() });
  });

  app.post("/api/decor/visualize", async (req, res) => {
    const allowedProviders = new Set<ImageProviderId>(["icbinp", "dreamshaper", "deliberate", "flux-schnell"]);
    const providers = getImageProviders();
    const requestedProviderRaw = req.body?.provider;
    const selectedProvider: ImageProviderId =
      typeof requestedProviderRaw === "string" && allowedProviders.has(requestedProviderRaw as ImageProviderId)
        ? (requestedProviderRaw as ImageProviderId)
        : "icbinp";

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
        variantIndex,
      } = req.body ?? {};

      if (typeof customPrompt === "string" && customPrompt.length > 1000) {
        return res.status(400).json({ error: "وصف التعديل طويل جداً، يرجى اختصاره إلى أقل من 1000 حرف." });
      }

      const hasImage = typeof imageBase64 === "string" && imageBase64.trim().length > 0;
      const parsed = hasImage
        ? parseBase64Image(imageBase64, typeof mimeType === "string" ? mimeType : "image/jpeg")
        : null;

      if (parsed && !["image/jpeg", "image/png", "image/webp"].includes(parsed.mimeType)) {
        return res.status(400).json({ error: "تنسيق الصورة غير مدعوم. يرجى استخدام JPG أو PNG أو WebP." });
      }

      if (!parsed && (!customPrompt || !String(customPrompt).trim()) && !proposal) {
        return res.status(400).json({ error: "يرجى إرفاق صورة للغرفة أو كتابة وصف للديكور المطلوب تخيله." });
      }

      const allowedRatios = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"]);
      const targetRatio = typeof aspectRatio === "string" && allowedRatios.has(aspectRatio) ? aspectRatio : "16:9";

      const hexColors = Array.isArray(proposal?.colorPalette)
        ? proposal.colorPalette
            .slice(0, 4)
            .map((c: { name?: string; hex?: string }) =>
              `${translateArabicDecorKeywords(c.name ?? "")} ${c.hex ?? ""}`.trim()
            )
            .filter(Boolean)
            .join(", ")
        : "";

      const roomTypeEn = translateArabicDecorKeywords(proposal?.roomType || "residential room");
      const styleEn = translateArabicDecorKeywords(proposal?.styleName || (typeof stylePreference === "string" ? stylePreference : "warm contemporary modern"));
      const focusEn = translateArabicDecorKeywords(typeof category === "string" && category.trim() ? category.trim() : "interior");
      const notesEn = typeof notes === "string" && notes.trim() ? translateArabicDecorKeywords(notes.trim()) : "";

      const providerInfo = providers.find((p) => p.id === selectedProvider);
      const isPhotoEdit = Boolean(parsed && providerInfo?.supportsPhotoEdit);

      const basePrompt = isPhotoEdit
        ? `photorealistic interior design redesign of this ${roomTypeEn}, preserve room architecture, walls, windows and perspective, natural realistic shadows, architectural digest photography`
        : `photorealistic interior design photograph of a stylish ${roomTypeEn}, natural realistic daylight and warm accent lighting, architectural digest editorial photography, ultra detailed`;

      const styleTemplates = [
        {
          id: "proposal-exact",
          label: "التصور المقترح",
          description: proposal?.styleName
            ? `تطبيق مقترح ${proposal.styleName} مع لوحة الألوان الموصى بها`
            : "تطبيق توصيات الديكور المقترحة",
          prompt: `${basePrompt}, ${styleEn} style, focus on ${focusEn}${hexColors ? `, color palette ${hexColors}` : ""}${notesEn ? `, ${notesEn}` : ""}`,
        },
        {
          id: "airy-bright",
          label: "إشراقة عصرية فاتحة",
          description: "درجات محايدة مشرقة وإضاءة نهارية ناعمة تمنح اتساعاً",
          prompt: `${basePrompt}, bright airy contemporary interior, warm off-white and soft sand walls, light oak wood textures, soft linen upholstery, warm-white pendant lighting, indoor plants, focus on ${focusEn}`,
        },
        {
          id: "warm-luxury",
          label: "دفء فاخر وأنيق",
          description: "تباين دافئ مع إضاءة مخفية ولمسات نحاسية وخشبية فاخرة",
          prompt: `${basePrompt}, warm luxury modern interior, rich warm neutral walls, walnut wood accents, textured boucle fabrics, warm 2700K indirect cove lighting, brushed brass decor, focus on ${focusEn}`,
        },
      ];

      const safeVariantIdx =
        typeof variantIndex === "number" && Number.isFinite(variantIndex) && variantIndex >= 0
          ? Math.floor(variantIndex) % styleTemplates.length
          : 0;
      const chosenTemplate = styleTemplates[safeVariantIdx];

      const customPromptEn =
        typeof customPrompt === "string" && customPrompt.trim()
          ? translateArabicDecorKeywords(customPrompt.trim())
          : "";

      const editTasks: Array<{ id: string; label: string; description: string; prompt: string }> =
        customPromptEn
          ? [
              {
                id: `custom-${Date.now()}`,
                label: isPhotoEdit ? "تعديل مخصص" : "تخيل ديكور مخصص",
                description: String(customPrompt).trim(),
                prompt: `${basePrompt}, ${customPromptEn}, ${styleEn} style, focus on ${focusEn}`,
              },
            ]
          : [
              {
                id: `${chosenTemplate.id}-${Date.now()}`,
                label: chosenTemplate.label,
                description: chosenTemplate.description,
                prompt: chosenTemplate.prompt,
              },
            ];

      const results = await Promise.allSettled(
        editTasks.map(async (task) => {
          let imageDataUrl = "";
          if (selectedProvider === "icbinp") {
            try {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["ICBINP - I Can't Believe It's Not Photography", "Realistic Vision", "AbsoluteReality"],
                parsed,
                targetRatio
              );
            } catch {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["Dreamshaper", "Deliberate", "majicMIX realistic"],
                parsed,
                targetRatio
              );
            }
          } else if (selectedProvider === "dreamshaper") {
            try {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["Dreamshaper", "DreamShaper XL", "majicMIX realistic"],
                parsed,
                targetRatio
              );
            } catch {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["ICBINP - I Can't Believe It's Not Photography", "Deliberate", "Realistic Vision"],
                parsed,
                targetRatio
              );
            }
          } else if (selectedProvider === "deliberate") {
            try {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["Deliberate 3.0", "Deliberate", "Edge Of Realism"],
                parsed,
                targetRatio
              );
            } catch {
              imageDataUrl = await generateWithAiHorde(
                task.prompt,
                ["ICBINP - I Can't Believe It's Not Photography", "Dreamshaper", "Realistic Vision"],
                parsed,
                targetRatio
              );
            }
          } else {
            imageDataUrl = await generateWithFluxSchnellOpen(task.prompt, null, targetRatio);
          }

          if (!imageDataUrl) {
            throw new Error("لم يرجع نموذج الصور صورة صالحة.");
          }

          return {
            id: task.id,
            label: task.label,
            description: task.description,
            imageDataUrl,
            provider: selectedProvider,
          };
        })
      );

      const options = results
        .filter(
          (
            r
          ): r is PromiseFulfilledResult<{
            id: string;
            label: string;
            description: string;
            imageDataUrl: string;
            provider: ImageProviderId;
          }> => r.status === "fulfilled"
        )
        .map((r) => r.value);

      if (options.length === 0) {
        const firstRejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
        if (firstRejected) {
          throw firstRejected.reason;
        }
        return res.status(502).json({ error: "لم يتمكن نموذج الصور من إنشاء التصور البصري." });
      }

      return res.json({ options, provider: selectedProvider });
    } catch (error) {
      const errObj = error as { status?: number; message?: string };
      const status = typeof errObj?.status === "number" ? errObj.status : 500;
      if (status >= 500) {
        console.error("Error in /api/decor/visualize:", errObj?.message || "Unknown error");
      }
      return handleImageProviderError(error, selectedProvider, res);
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
