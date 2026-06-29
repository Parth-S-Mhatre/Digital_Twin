from __future__ import annotations

import os
import asyncio
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, AsyncGenerator

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from openai import OpenAI, AsyncOpenAI
    NVIDIA_AVAILABLE = True
except ImportError:
    NVIDIA_AVAILABLE = False


class LLMProvider(Enum):
    NVIDIA = "nvidia"
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


# Model-specific configuration
MODEL_CONFIG = {
  "google/diffusiongemma-26b-a4b-it": {
    "max_tokens": 4096,
    "temperature": 1.0,
    "top_p": 0.95
  },
  "nvidia/llama-3.1-nemotron-70b-instruct": {
    "max_tokens": 131072,
    "temperature": 1.0,
    "top_p": 0.95
  }
}


class MedicalLLMService:
    def __init__(self) -> None:
        self.nvidia_client: Optional[OpenAI] = None
        self.async_nvidia_client: Optional[AsyncOpenAI] = None
        self.default_model = "google/diffusiongemma-26b-a4b-it"
        self._init_clients()

    def _init_clients(self) -> None:
        if NVIDIA_AVAILABLE:
            nvidia_key = os.getenv("NVIDIA_API_KEY")
            print(f"[DEBUG] NVIDIA_API_KEY found: {nvidia_key is not None}")
            if nvidia_key:
                try:
                    self.nvidia_client = OpenAI(
                        base_url="https://integrate.api.nvidia.com/v1",
                        api_key=nvidia_key
                    )
                    self.async_nvidia_client = AsyncOpenAI(
                        base_url="https://integrate.api.nvidia.com/v1",
                        api_key=nvidia_key
                    )
                    print(f"[DEBUG] NVIDIA client initialized successfully!")
                except Exception as e:
                    print(f"[DEBUG] Error initializing NVIDIA client: {str(e)}")

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
7. Avoid unnecessary symbols, emojis, or markdown formatting like asterisks, exclamation points in excess

Respond in a helpful, supportive tone."""

    def _get_patient_context_prompt(self, patient_data: Optional[Dict[str, Any]] = None) -> str:
        if not patient_data:
            return ""
        
        context_parts = ["\nPatient context:"]
        for key, value in patient_data.items():
            if value is not None:
                context_parts.append(f"- {key}: {value}")
        return "\n".join(context_parts)

    def _clean_output(self, text: str) -> str:
        """Clean text for document generation by removing unnecessary symbols."""
        # Remove excessive asterisks, exclamation points, and other symbols
        cleaned = re.sub(r'\*+', '', text)
        cleaned = re.sub(r'!+', '.', cleaned)
        cleaned = re.sub(r'[^\w\s.,;:()-]', '', cleaned)
        # Clean up multiple spaces/newlines
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned)
        return cleaned.strip()

    async def chat_with_medical_llm(
        self,
        user_message: str,
        conversation_history: Optional[List[Message]] = None,
        patient_data: Optional[Dict[str, Any]] = None,
        preferred_provider: Optional[LLMProvider] = None,
        model: Optional[str] = None
    ) -> ChatResponse:
        history = conversation_history or []
        system_prompt = self._get_medical_system_prompt()
        patient_context = self._get_patient_context_prompt(patient_data)
        selected_model = model or self.default_model
        
        providers_to_try = [LLMProvider.NVIDIA, LLMProvider.FALLBACK]

        for provider in providers_to_try:
            try:
                print(f"[DEBUG] Trying provider: {provider}")
                if provider == LLMProvider.NVIDIA and self.nvidia_client:
                    return await self._query_nvidia(user_message, history, system_prompt, patient_context, selected_model)
                elif provider == LLMProvider.FALLBACK:
                    return self._fallback_response(user_message, patient_data)
            except Exception as e:
                print(f"[DEBUG] Error with provider {provider}: {str(e)}")
                continue

        return self._fallback_response(user_message, patient_data)

    async def chat_with_medical_llm_stream(
        self,
        user_message: str,
        conversation_history: Optional[List[Message]] = None,
        patient_data: Optional[Dict[str, Any]] = None,
        preferred_provider: Optional[LLMProvider] = None,
        model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream responses token by token from NVIDIA API."""
        history = conversation_history or []
        system_prompt = self._get_medical_system_prompt()
        patient_context = self._get_patient_context_prompt(patient_data)
        selected_model = model or self.default_model
        config = MODEL_CONFIG.get(selected_model, MODEL_CONFIG[self.default_model])
        
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        if not self.async_nvidia_client:
            # Fallback if async client not available
            yield self._fallback_response(user_message, patient_data).response
            return

        try:
            stream = await self.async_nvidia_client.chat.completions.create(
                model=selected_model,
                messages=messages,
                temperature=config["temperature"],
                top_p=config["top_p"],
                max_tokens=config["max_tokens"],
                stream=True
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            print(f"[DEBUG] Stream error: {str(e)}")
            yield f"Error: {str(e)}"

    async def _query_nvidia(
        self,
        user_message: str,
        history: List[Message],
        system_prompt: str,
        patient_context: str,
        model: str
    ) -> ChatResponse:
        messages = [{"role": "system", "content": system_prompt + patient_context}]
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        config = MODEL_CONFIG.get(model, MODEL_CONFIG[self.default_model])

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.nvidia_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=config["temperature"],
                top_p=config["top_p"],
                max_tokens=config["max_tokens"]
            )
        )

        cleaned_response = self._clean_output(response.choices[0].message.content)

        return ChatResponse(
            response=cleaned_response,
            provider="nvidia",
            model=model,
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
        response += "Note: For personalized health advice, please consult with a licensed healthcare professional.\n"

        return ChatResponse(
            response=self._clean_output(response),
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
        
        if self.nvidia_client:
            providers.append({
                "name": "NVIDIA",
                "model": self.default_model,
                "status": "available",
                "free_tier": True,
                "medical_capability": "Excellent (DiffusionGemma)",
                "max_tokens": MODEL_CONFIG[self.default_model]["max_tokens"]
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
