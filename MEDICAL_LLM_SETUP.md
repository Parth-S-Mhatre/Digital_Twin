# Medical LLM Integration Guide

## Overview

This Digital Twin project now integrates with **free, medical-capable Large Language Models (LLMs)** to provide intelligent health guidance and personalized recommendations. Instead of relying solely on rule-based systems, you can now use state-of-the-art AI models trained on medical knowledge.

## Free Medical LLM API Options

Based on current benchmarks and availability, here are the **best free options** for medical AI:

### 1. **SiliconFlow (RECOMMENDED) 🚀

**Why SiliconFlow?**
- ✅ **Free models** (Qwen2.5-7B-Instruct and more)
- ✅ **Excellent performance**
- ✅ **OpenAI-compatible API**
- ✅ **No credit card required**
- ✅ **Multiple models available** (DeepSeek, Qwen, GLM, etc.)

**Model:** `Qwen/Qwen2.5-7B-Instruct`

**Setup:**
1. Go to: https://cloud.siliconflow.cn/
2. Sign up for a free account
3. Create a new API key
4. Add to your `.env` file:
   ```
   SILICONFLOW_API_KEY=your_key_here
   ```

### 2. **Qwen (Alibaba Cloud) 🌟**

**Why Qwen?**
- ✅ **1M free tokens** for new users (90 days validity)
- ✅ **Good medical capability**
- ✅ **Official Alibaba product**
- ✅ **No credit card required**

**Model:** `qwen-plus`

**Setup:**
1. Go to: https://bailian.console.aliyun.com/
2. Sign up for Alibaba Cloud (free tier available)
3. Create API key
4. Add to your `.env` file:
   ```
   QWEN_API_KEY=your_key_here
   ```

**Note: You can also use Qwen via OpenRouter with `qwen/qwen3.6-plus:free`

### 3. **Groq ⚡**

**Why Groq?**
- ✅ **Excellent medical knowledge** (Llama 3.1/3.3 70B models)
- ✅ **Extremely fast** (500+ tokens/second)
- ✅ **Generous free tier** (14,400 requests/day)
- ✅ **No credit card required**
- ✅ **Simple API**

**Model:** `llama-3.3-70b-versatile`

**Setup:**
1. Go to: https://console.groq.com/keys
2. Sign up for a free account
3. Create a new API key
4. Add to your `.env` file:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```

### 4. **Google Gemini 🔬**

**Why Gemini?**
- ✅ **Top medical scores** (Gemini 2.0 leads in medical benchmarks)
- ✅ **Very generous free tier** (1,500 requests/day, 1M tokens/min)
- ✅ **Official Google product** - reliable and trusted
- ✅ **No credit card required**

**Model:** `gemini-2.0-flash`

**Setup:**
1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Create API key
4. Add to your `.env` file:
   ```
   GOOGLE_API_KEY=your_key_here
   ```

### 5. **OpenRouter 🤖**

**Why OpenRouter?**
- ✅ **Access to 100+ models** (many free options)
- ✅ **Unified API** - easy to switch models
- ✅ **Free models available** including Qwen 3.6+
- ✅ **Supports reasoning** for better medical analysis

**Model:** `qwen/qwen3.6-plus:free` or `meta-llama/llama-3.1-70b-instruct:free`

**Setup:**
1. Go to: https://openrouter.ai/keys
2. Sign up for free
3. Create API key
4. Add to your `.env` file:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```

### Comparison Table

| Feature | SiliconFlow | Qwen | Groq | Gemini | OpenRouter | Fallback |
|---------|-------------|------|------|--------|------------|----------|
| Cost | Free | Free | Free | Free | Free* | Free |
| Speed | ⚡⚡⚡ | ⚡⚡ | ⚡⚡⚡ | ⚡⚡ | ⚡ | ⚡⚡⚡ |
| Medical Knowledge | Good | Good | Excellent | Excellent (Top) | Good | Basic |
| Limits | Limited | 1M tokens | 14,400/day | 1,500/day | Limited | Unlimited |
| Setup Time | 2 mins | 2 mins | 2 mins | 2 mins | 2 mins | None |
| Credit Card | No | No | No | No | No | No |

## Quick Start

### 1. Install Dependencies
```bash
cd Backend
pip install -r requirements.txt
```

### 2. Configure API Keys
Copy `.env.example` to `.env` and add your keys:
```bash
cp .env.example .env
# Edit .env and add at least one API key (start with SiliconFlow!)
```

### 3. Run the Server
```bash
uvicorn app.main:app --reload
```

### 4. Test the API
Visit `http://localhost:8000/docs` to see interactive documentation!

## New API Endpoints

### 1. **Medical Chatbot** - `POST /medical-chat`

Chat with a medical AI assistant that can understand your health profile.

**Request Body:**
```json
{
  "user_message": "What should I do about my high blood pressure?",
  "conversation_history": [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hello! How can I help you today?"}
  ],
  "patient_data": {
    "age": 45,
    "sex": "Male",
    "bmi": 28.5,
    "blood_pressure_systolic": 145,
    "blood_pressure_diastolic": 92
  },
  "preferred_provider": "siliconflow"
}
```

**Response:**
```json
{
  "response": "Based on your profile, here's what I recommend...",
  "provider": "siliconflow",
  "model": "Qwen2.5-7B-Instruct",
  "success": true,
  "error": null
}
```

### 2. **AI Recommendations** - `POST /medical-recommendations`

Get personalized health recommendations based on patient data and risk profile.

**Request Body:**
```json
{
  "patient_data": {
    "age": 52,
    "sex": "Female",
    "bmi": 31.2,
    "physical_activity": 0,
    "diet_quality": 2.5,
    "smoking_status": "Former",
    "medical_history_diabetes": 0,
    "medical_history_hypertension": 1
  },
  "risk_score": 72,
  "risk_category": "high"
}
```

### 3. **List Providers** - `GET /medical-ai/providers`

See which LLM providers are currently available and configured.

### 4. **Info** - `GET /medical-ai/info`

Get comprehensive information about the medical AI features.

## How It Works

The system automatically tries providers in this priority order:
1. Your preferred provider (if specified)
2. SiliconFlow (if configured - RECOMMENDED)
3. Qwen (if configured)
4. Groq (if configured)
5. Google Gemini (if configured)
6. OpenRouter (if configured)
7. Rule-based fallback (always works, no API needed)

If a provider fails, it automatically falls back to the next one!

## Medical LLM Benchmarks (2025-2026)

Based on recent medical AI evaluations:

| Model | Medical Score | Notes |
|-------|--------------|-------|
| Gemini 2.0 Pro | 73.7 | Best overall |
| Gemini 2.0 Flash | 67.8 | Excellent for free tier |
| Qwen 3.6 Plus | ~65 | Very good |
| Llama 3.1 70B | ~65 | Very good, fast |
| GPT-4 | ~70 | Good but not free |

## Important Notes

⚠️ **Medical Disclaimer:** The AI assistant provides general health information and is **not a substitute for professional medical advice, diagnosis, or treatment**. Always consult qualified healthcare providers.

💰 **Free Tiers:** All options above have free tiers that are sufficient for development and testing. No credit card required!

🔒 **Privacy:** Review each provider's privacy policy. If privacy is critical, consider self-hosted open-source models (advanced).

## Troubleshooting

**Q: API key not working?**
- Double-check your `.env` file
- Restart the server after changes
- Verify key hasn't expired or exceeded limits

**Q: Getting fallback responses?**
- Make sure at least one API key is set
- Check `/medical-ai/providers` to see what's available
- Fallback means no APIs are configured, but it still works!

**Q: Rate limits hit?**
- Try a different provider
- SiliconFlow or Qwen have good free tiers
- Consider implementing caching

## Next Steps

1. Get at least one free API key (start with SiliconFlow - easiest and most reliable free option!)
2. Test the chatbot via the `/docs` page
3. Integrate the endpoints into your frontend
4. Monitor usage to stay within free limits

Enjoy your intelligent medical AI assistant! 🩺✨
