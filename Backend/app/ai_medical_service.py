from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

try:
    import google.generativeai as genai
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

try:
    from openai import OpenAI
    OPENROUTER_AVAILABLE = True
except ImportError:
    OPENROUTER_AVAILABLE = False


class LLMProvider(Enum):
    GROQ = "groq"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"
    SILICONFLOW = "siliconflow"
    QWEN = "qwen"
    FALLBACK = "fallback"


@dataclass
class Message:
    role: str
    content: str


@dataclass
class ChatResponse:
    response: str
    provider: str
    model: str
    success: bool
    error: Optional[str] = None


class MedicalLLMService:
    def __init__(self) -> None:
        self.groq_client: Optional[Groq] = None
        self.gemini_model: Optional[Any] = None
        self.openrouter_client: Optional[OpenAI] = None
        self.siliconflow_client: Optional[OpenAI] = None
        self.qwen_client: Optional[OpenAI] = None
        self._init_clients()

    def _init_clients(self) -> None:
        if GROQ_AVAILABLE:
            groq_key = os.getenv("GROQ_API_KEY")
            if groq_key:
                try:
                    self.groq_client = Groq(api_key=groq_key)
                except Exception:
                    pass

        if GOOGLE_AVAILABLE:
            google_key = os.getenv("GOOGLE_API_KEY")
            if google_key:
                try:
                    genai.configure(api_key=google_key)
                    self.gemini_model = genai.GenerativeModel("gemini-2.0-flash")
                except Exception:
                    pass

        if OPENROUTER_AVAILABLE:
            openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if openrouter_key:
                try:
                    self.openrouter_client = OpenAI(
                        base_url="https://openrouter.ai/api/v1",
                        api_key=openrouter_key
                    )
                except Exception:
                    pass

        if OPENROUTER_AVAILABLE:
            siliconflow_key = os.getenv("SILICONFLOW_API_KEY")
            if siliconflow_key:
                try:
                    self.siliconflow_client = OpenAI(
                        base_url="https://api.siliconflow.cn/v1",
                        api_key=siliconflow_key
                    )
                except Exception:
                    pass

        if OPENROUTER_AVAILABLE:
            qwen_key = os.getenv("QWEN_API_KEY")
            if qwen_key:
                try:
                    self.qwen_client = OpenAI(
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                        api_key=qwen_key
                    )
                except Exception:
                    pass

    def _get_medical_system_prompt(self) -> str:
        return """You are a knowledgeable, compassionate medical AI assistant for a Digital Twin health application. 
Your role is to help users understand their health data, risks, and recommendations.

Key guidelines:
1. Provide evidence-based, accurate medical information
2. Always clarify that you are not a substitute for professional medical advice, diagnosis, or treatment
3. Keep responses clear and easy to understand
4. When discussing risks, be balanced and not alarmist
5. Personalize advice based on the user's specific health profile when available
6. Encourage users to consult with healthcare professionals for personalized care

Respond in a helpful, supportive tone."""

    def _get_patient_context_prompt(self, patient_data: Optional[Dict[str, Any]] = None) -> str:
        if not patient_data:
            return ""
        
        context_parts = ["\nPatient context:"]
        for key, value in patient_data.items():
            if value is not None:
                context_parts.append(f"- {key}: {value}")
        return "\n".join(context_parts)

    async def chat_with_medical_llm(
        self,
        user_message: str,
        conversation_history: Optional[List[Message]] = None,
        patient_data: Optional[Dict[str, Any]] = None,
        preferred_provider: Optional[LLMProvider] = None
    ) -> ChatResponse:
        history = conversation_history or []
        system_prompt = self._get_medical_system_prompt()
        patient_context = self._get_patient_context_prompt(patient_data)
        
        providers_to_try = []
        if preferred_provider:
            providers_to_try.append(preferred_provider)
        providers_to_try.extend([
            LLMProvider.SILICONFLOW,
            LLMProvider.QWEN,
            LLMProvider.GROQ,
            LLMProvider.GEMINI,
            LLMProvider.OPENROUTER,
            LLMProvider.FALLBACK
        ])

        for provider in providers_to_try:
            try:
                if provider == LLMProvider.SILICONFLOW and self.siliconflow_client:
                    return await self._query_siliconflow(user_message, history, system_prompt, patient_context)
                elif provider == LLMProvider.QWEN and self.qwen_client:
                    return await self._query_qwen(user_message, history, system_prompt, patient_context)
                elif provider == LLMProvider.GROQ and self.groq_client:
                    return await self._query_groq(user_message, history, system_prompt, patient_context)
                elif provider == LLMProvider.GEMINI and self.gemini_model:
                    return await self._query_gemini(user_message, history, system_prompt, patient_context)
                elif provider == LLMProvider.OPENROUTER and self.openrouter_client:
                    return await self._query_openrouter(user_message, history, system_prompt, patient_context)
                elif provider == LLMProvider.FALLBACK:
                    return self._fallback_response(user_message, patient_data)
            except Exception as e:
                continue

        return self._fallback_response(user_message, patient_data)

    async def _query_groq(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str
    ) -> ChatResponse:
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        response = self.groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            provider="groq",
            model="llama-3.3-70b-versatile",
            success=True
        )

    async def _query_gemini(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str
    ) -> ChatResponse:
        full_prompt = system_prompt + patient_context + "\n\n"
        for msg in history:
            full_prompt += f"{msg.role}: {msg.content}\n"
        full_prompt += f"user: {user_message}\nassistant:"

        response = self.gemini_model.generate_content(full_prompt)

        return ChatResponse(
            response=response.text,
            provider="gemini",
            model="gemini-2.0-flash",
            success=True
        )

    async def _query_openrouter(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str
    ) -> ChatResponse:
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        response = self.openrouter_client.chat.completions.create(
            model="meta-llama/llama-3.1-70b-instruct:free",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            provider="openrouter",
            model="llama-3.1-70b-instruct:free",
            success=True
        )

    async def _query_siliconflow(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str
    ) -> ChatResponse:
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        response = self.siliconflow_client.chat.completions.create(
            model="Qwen/Qwen2.5-7B-Instruct",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            provider="siliconflow",
            model="Qwen2.5-7B-Instruct",
            success=True
        )

    async def _query_qwen(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str
    ) -> ChatResponse:
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        response = self.qwen_client.chat.completions.create(
            model="qwen-plus",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            provider="qwen",
            model="qwen-plus",
            success=True
        )

    def _fallback_response(
        self,
        user_message: str,
        patient_data: Optional[Dict[str, Any]] = None
    ) -> ChatResponse:
        response = "I'm here to help with health-related questions! Here are some general health tips:\n\n"
        response += "1. Maintain a balanced diet rich in fruits, vegetables, and whole grains\n"
        response += "2. Get regular physical activity (aim for 150+ minutes/week)\n"
        response += "3. Stay hydrated by drinking plenty of water\n"
        response += "4. Get 7-9 hours of quality sleep each night\n"
        response += "5. Manage stress through mindfulness, meditation, or relaxation techniques\n\n"
        response += "Note: For personalized health advice, please consult with a licensed healthcare professional.\n\n"
        response += "To access advanced AI-powered medical insights, you can set up a free LLM API key (see documentation)."

        return ChatResponse(
            response=response,
            provider="fallback",
            model="rule-based",
            success=True
        )

    async def generate_personalized_recommendations(
        self,
        patient_data: Dict[str, Any],
        risk_score: Optional[float] = None,
        risk_category: Optional[str] = None
    ) -> ChatResponse:
        prompt = "Based on this patient's health profile, please provide personalized health recommendations.\n\n"
        
        if risk_score is not None:
            prompt += f"Risk score (0-100): {risk_score}\n"
        if risk_category:
            prompt += f"Risk category: {risk_category}\n"
        
        prompt += "\nPlease include:\n"
        prompt += "1. Key health observations\n"
        prompt += "2. 3-5 actionable, prioritized recommendations\n"
        prompt += "3. Lifestyle modifications\n"
        prompt += "4. When to consider consulting a healthcare provider\n"

        return await self.chat_with_medical_llm(
            user_message=prompt,
            patient_data=patient_data
        )

    def get_available_providers(self) -> List[Dict[str, Any]]:
        providers = []
        
        if self.siliconflow_client:
            providers.append({
                "name": "SiliconFlow",
                "model": "Qwen2.5-7B-Instruct",
                "status": "available",
                "free_tier": True,
                "medical_capability": "Good (Free models available)"
            })
        
        if self.qwen_client:
            providers.append({
                "name": "Qwen (Alibaba)",
                "model": "qwen-plus",
                "status": "available",
                "free_tier": True,
                "medical_capability": "Good (1M free tokens)"
            })
        
        if self.groq_client:
            providers.append({
                "name": "Groq",
                "model": "llama-3.3-70b-versatile",
                "status": "available",
                "free_tier": True,
                "medical_capability": "Excellent (Llama 3.3)"
            })
        
        if self.gemini_model:
            providers.append({
                "name": "Google Gemini",
                "model": "gemini-2.0-flash",
                "status": "available",
                "free_tier": True,
                "medical_capability": "Excellent (Top medical scores)"
            })
        
        if self.openrouter_client:
            providers.append({
                "name": "OpenRouter",
                "model": "llama-3.1-70b-instruct:free",
                "status": "available",
                "free_tier": True,
                "medical_capability": "Good"
            })
        
        providers.append({
            "name": "Fallback",
            "model": "rule-based",
            "status": "always_available",
            "free_tier": True,
            "medical_capability": "Basic (no API needed)"
        })

        return providers


medical_llm_service = MedicalLLMService()
