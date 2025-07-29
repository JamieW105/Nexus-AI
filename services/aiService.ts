
import { GoogleGenAI, Type } from "@google/genai";
import { AiModel, ModelInfo } from '../types.ts';

export class AiServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        actions: {
            type: Type.ARRAY,
            description: "A list of actions to perform.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: {
                        type: Type.STRING,
                        enum: ['edit', 'create', 'delete', 'chat'],
                        description: "The type of action to perform."
                    },
                    fileId: {
                        type: Type.STRING,
                        description: "The ID of the file/folder for 'edit' or 'delete' actions."
                    },
                    content: {
                        type: Type.STRING,
                        description: "The new content for 'edit' or 'create' file actions."
                    },
                    parentId: {
                        type: Type.STRING,
                        description: "The ID of the parent folder for 'create' actions (null for root)."
                    },
                    fileType: {
                        type: Type.STRING,
                        enum: ['file', 'folder'],
                        description: "The type of node to 'create'."
                    },
                    name: {
                        type: Type.STRING,
                        description: "The name for the new file/folder in a 'create' action."
                    },
                    message: {
                        type: Type.STRING,
                        description: "The conversational response for a 'chat' action."
                    }
                },
                required: ['type']
            }
        }
    },
    required: ['actions']
};


const systemInstruction = `You are an expert full-stack web developer AI assistant. Your task is to help users build web applications by providing a sequence of actions in a single JSON object.

Your entire response MUST be a single, valid JSON object, and nothing else.

The JSON object must have a single key, "actions", which is an array of action objects.
Each action object must have a "type" field. Based on the type, other fields are required:
- type: "edit" -> requires "fileId" (string) and "content" (string).
- type: "create" -> requires "parentId" (string ID or null for root), "fileType" ('file' or 'folder'), and "name" (string). If "fileType" is "file", it also requires "content" (string).
- type: "delete" -> requires "fileId" (string).
- type: "chat" -> requires "message" (string) for conversational replies.

- Analyze the user's request, the provided file structure (with file paths and IDs), and the content of open files.
- Use the provided 'fileId' for any file-specific operations. Use the 'path' for your own context and understanding only.
- For 'create', use the parent folder's ID for 'parentId'. For root-level files/folders, 'parentId' should be null.
- If a request requires multiple steps (e.g., create a CSS file, then edit HTML to link to it), provide all necessary actions in the correct order in the 'actions' array.
- ERROR FIXING: If the prompt is an "AUTO-FIX" request, your primary goal is to resolve the provided error. Analyze the error message and the faulty code, then generate a new set of actions to correct the problem.
- Prioritize creating modern, responsive, and aesthetically pleasing websites, using Tailwind CSS classes and semantic HTML where appropriate.`;


async function generateGeminiContent(prompt: string, jsonOutput: boolean): Promise<string> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new AiServiceError('Gemini API key is not configured.', 'missing_key');
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                ...(jsonOutput && { 
                    responseMimeType: "application/json",
                    responseSchema,
                }),
                systemInstruction,
            }
        });
        const text = response.text;
        if (!text) {
             throw new AiServiceError('Received an empty response from Gemini.', 'api_error');
        }
        return text;
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        // Check for specific XHR/network errors which might indicate a key issue (e.g., missing referrer)
        if (error.message && (error.message.includes('xhr') || error.message.includes('fetch'))) {
             throw new AiServiceError('A network error occurred connecting to Gemini. This can be caused by an invalid API key or incorrect API key restrictions (e.g., missing HTTP referrer). Please check your Gemini API key settings in the environment variables.', 'api_error');
        }
        const errorMessage = error.message || String(error);
        throw new AiServiceError(`Failed to get response from Gemini. ${errorMessage}`, 'api_error');
    }
}

async function generateDeepSeekContent(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new AiServiceError('DeepSeek API key is not configured. Please set the DEEPSEEK_API_KEY environment variable.', 'missing_key');
    }
    const url = "https://api.deepseek.com/chat/completions";

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { "role": "system", "content": systemInstruction },
                    { "role": "user", "content": prompt }
                ],
                // Use Deepseek's native JSON output mode
                response_format: { "type": "json_object" }, 
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Gracefully handle non-json error responses
            console.error("DeepSeek API Error:", errorData);
            throw new AiServiceError(`DeepSeek API request failed: ${errorData?.error?.message || response.statusText}`, 'api_error');
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        
        if (!content || typeof content !== 'string') {
            console.error("DeepSeek API response is not in the expected format:", data);
            throw new AiServiceError('DeepSeek returned an empty or invalid response.', 'api_error');
        }
        return content;

    } catch (error) {
        console.error("DeepSeek Fetch Error:", error);
        if (error instanceof AiServiceError) throw error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new AiServiceError(`Failed to get response from DeepSeek. ${errorMessage}`, 'network_error');
    }
}

export async function getAiResponse(prompt: string, model: AiModel, jsonOutput: boolean = false): Promise<string> {
    switch (model) {
        case 'gemini':
            return generateGeminiContent(prompt, jsonOutput);
        case 'deepseek':
            // DeepSeek is controlled to produce JSON via parameters, so `jsonOutput` is implicitly true.
            return generateDeepSeekContent(prompt);
        default:
            throw new AiServiceError(`Unsupported AI model selected: ${model}.`, 'invalid_model');
    }
}