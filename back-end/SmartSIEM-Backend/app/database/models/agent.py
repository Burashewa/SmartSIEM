"""Pydantic models for agents."""

from pydantic import BaseModel


class AgentCreate(BaseModel):
    agent_id: str
    hostname: str | None = None
    ip: str | None = None
    status: str = "online"


class AgentOut(AgentCreate):
    id: str
    last_seen: str | None = None
