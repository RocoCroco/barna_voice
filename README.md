# barna_voice

┌──────────────────────── Web App ────────────────────────┐
│                                                        │
│  UI catálogo / listas / perfil      Voice interface    │
│            │                              │             │
└────────────┼──────────────────────────────┼─────────────┘
             │                              │
             ▼                              ▼
        Backend API                    Unmute / SLNG
             │                         Voice Agent
             │                              │
             ├────────── Tools/API ◄────────┘
             │
     ┌───────┴──────────┐
     ▼                  ▼
User/Profile DB    Recommendation Service
     │                  │
     │                  ├─ LLM
     │                  ├─ reglas/filtros
     │                  └─ catálogo de películas
     │
     └──────────────────┘
