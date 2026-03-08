"""
function_tools.py -- Gemini function call schemas + handler routing.
"""

from typing import Dict, Any, Callable, Optional
import asyncio

VITALS_TOOLS = [
    {
        "name": "get_vitals_snapshot",
        "description": "Get current vital signs readings including heart rate, stress, and more.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_baseline_comparison",
        "description": "Compare current vitals to the baseline established during calibration.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_session_arc",
        "description": "Get the full session timeline with vitals history and key moments.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


class FunctionRouter:
    def __init__(self) -> None:
        self._handlers: Dict[str, Callable] = {}

    def register_handler(self, name: str, handler: Callable) -> None:
        self._handlers[name] = handler

    async def handle_call(self, function_name: str, args: Optional[Dict] = None) -> Dict:
        handler = self._handlers.get(function_name)
        if handler is None:
            return {"error": f"Unknown function: {function_name}"}
        args = args or {}
        result = handler(**args)
        if asyncio.iscoroutine(result):
            result = await result
        return result
