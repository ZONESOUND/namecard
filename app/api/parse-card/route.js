import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// OpenAI client initialized per request to avoid build-time env check issues
const apiKey = process.env.OPENAI_API_KEY;

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Convert file to base64
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Image = buffer.toString('base64');
        const dataUrl = `data:${file.type};base64,${base64Image}`;

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert personal secretary for a professional based in Taiwan.
          Your task is to extract information from a business card image, and ENRICH it with your internal knowledge.
          
          **OCR Correction & Reasoning (Critical)**:
          - Business cards often have small fonts or stylized text that OCR might misread (e.g., 'i' vs 'l', '0' vs 'o'). 
          - **Domain-to-Company Mapping**: Analyze the email domain deeply. You MUST use the domain to identify the organization even if the name is not visible in the photo:
            - '@tmc.taipei' -> ALWAYS set company to '台北流行音樂中心 (Taipei Music Center)'
            - '@itri.org.tw' -> ALWAYS set company to '工業技術研究院 (ITRI)'
            - '@moc.gov.tw' -> ALWAYS set company to '文化部 (Ministry of Culture)'
            - '@nycu.edu.tw', '@nctu.edu.tw', '@ym.edu.tw' -> ALWAYS set company to '國立陽明交通大學 (NYCU)'
            - '@ntu.edu.tw' -> ALWAYS set company to '國立台灣大學 (NTU)'
          - If the 'company' field is blank in OCR but the email provider is official/institutional, USE THE INSTITUTION NAME as the company.
          - Use your internal knowledge of organizations to FIX obviously misread characters in names, titles, and unit names.

          1. **Extraction & Naming**:
             - Name: Combine Chinese and English if both exist: "Chinese Name (English Name)".
             - Company: ALWAYS use the FULL OFFICIAL NAME. (e.g., Use "台北流行音樂中心" instead of "北流").
          
          2. **Translation & Standardization**:
             - If the Job Title is in English, provide a Traditional Chinese translation in 'title_zh'. If it's already in Chinese, leave 'title_zh' empty or duplicate it.
             - If the card is in English, ensure the 'name' field is still the primary name used on the card.
          
          3. **Enrichment (Fact-focused)**:
             - Provide a 'aiSummary' in **Traditional Chinese (繁體中文)**.
             - **CRITICAL**: Use a neutral, professional tone. Avoid flowery language, excessive praise, or marketing-style adjectives (e.g., avoid "卓越", "領先", "傑出").
             - Focus on verifiable facts: The organization's primary industry, key projects, or public role.
             - If the person or unit is relatively unknown, do NOT guess. Provide only what is strictly verifiable or leave it empty/brief.
             - Do NOT hallucinate people's biographies.
          
          Return JSON only. Format:
          {
            "name": "",
            "title": "",
            "title_zh": "", 
            "company": "",
            "email": "",
            "phone": "",
            "website": "",
            "address": "",
            "tags": [], 
            "aiSummary": "繁體中文的背景介紹與分析... (若不確定請勿硬寫)"
          }
          If a field is missing, use an empty string. Generate 3-5 smart tags. 
          **Tagging Rules**:
          - **No Redundancy**: If a name exists in the 'company' field, do NOT add it as a tag (e.g., if company is '台北流行音樂中心', do NOT add tags like '北流' or '台北流行音樂中心'). 
          - **Deduplication**: Never include both a full name and its abbreviation as tags.
          - Always use "Taiwan" (not "台灣", "R.O.C.") for the primary nationality/region tag.
          - Use "公司" for commercial entities.
          - Avoid vague tags like "文化".
          - Use consistent topic tags.
          **Crucial**: Also include the "Taiwan" tag if detectable based on the address, phone code, or company context.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Parse this business card." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": dataUrl,
                            },
                        },
                    ],
                },
            ],
            response_format: { type: "json_object" },
            max_tokens: 1000,
        });

        const parsedData = JSON.parse(response.choices[0].message.content);

        // Combine title and title_zh for the frontend if needed, or just let the frontend handle it.
        // Let's refine the title to be "En Title (Zh Title)" if both exist? 
        // Actually, keep it separate in data, but frontend form doesn't support 'title_zh' yet. 
        // Let's merge them for the 'title' field to ensure it shows up without changing frontend schema too much yet.
        if (parsedData.title_zh && parsedData.title && parsedData.title !== parsedData.title_zh) {
            parsedData.title = `${parsedData.title} (${parsedData.title_zh})`;
        } else if (parsedData.title_zh && !parsedData.title) {
            parsedData.title = parsedData.title_zh;
        }

        return NextResponse.json(parsedData);

    } catch (error) {
        console.error('OCR Error:', error);
        return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }
}
