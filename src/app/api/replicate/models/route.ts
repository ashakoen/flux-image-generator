// src/app/api/replicate/models/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
      const apiKey = req.headers.get('Authorization')?.split(' ')[1];
  
      if (!apiKey) {
        console.error('Error: API key is missing');
        return NextResponse.json({ error: 'API key is required' }, { status: 400 });
      }
  
      // Hardcoded array of model objects
      const models = [
        {
          name: "flux-dev-realism",
          description: "FLUX.1-dev with XLabs-AI’s realism lora",
          owner: "xlabs-ai",
          visibility: "public",
          latest_version: "39b3434f194f87a900d1bc2b6d4b983e90f0dde1d5022c27b52c143d670758fa"
        },
        {
          name: "flux-half-illustration",
          description: "Flux lora, use 'in the style of TOK' to trigger generation, creates half photo half illustrated elements",
          owner: "davisbrown",
          visibility: "public",
          latest_version: "687458266007b196a490e79a77bae4b123c1792900e1cb730a51344887ad9832"
        },
        {
          name: "flux-childbook-illustration",
          description: "Flux Lora, use 'in the style of TOK' in your prompt as trigger",
          owner: "samsa-ai",
          visibility: "public",
          latest_version: "cc3beea6ddc39416cf121390b476b1a8802ca47db03fb97306ef6c25f38f60a2"
        }
      ];
  
      return NextResponse.json(models);
  
    } catch (error) {
      console.error('Server Error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }