import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

const STORAGE_KEY = "albert-conversations-v1";

const quickPrompts = [
  { label: "Explique uma ideia", prompt: "Me explica gravidade com um exemplo simples." },
  { label: "Resolva uma conta", prompt: "Quanto é 18% de 250?" },
  { label: "Monte um plano", prompt: "Me ajuda a montar um plano para estudar esta semana." },
];

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Conversation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.updatedAt === "number" &&
    Array.isArray(candidate.messages)
  );
}

function readConversations(): Conversation[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isConversation) : [];
  } catch {
    return [];
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(value);
}

function calculateAnswer(question: string): string | null {
  const normalized = normalizeText(question);
  const percentMatch = normalized.match(
    /(-?\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da)\s*(-?\d+(?:[.,]\d+)?)/,
  );

  if (percentMatch) {
    const percentage = Number(percentMatch[1].replace(",", "."));
    const base = Number(percentMatch[2].replace(",", "."));
    const result = (percentage / 100) * base;

    return [
      "🔬 Albert — Cientista & Matemático",
      "",
      "📐 Dados:",
      `→ ${formatNumber(percentage)}% de ${formatNumber(base)}`,
      "",
      "🧮 Raciocínio:",
      `${formatNumber(percentage)}% de ${formatNumber(base)} = ${formatNumber(percentage / 100)} × ${formatNumber(base)} = ${formatNumber(result)}.`,
      "",
      "📝 Conclusão:",
      `→ ${formatNumber(result)}.`,
    ].join("\n");
  }

  const expression = normalized.match(
    /(-?\d+(?:[.,]\d+)?)\s*([+\-*/×x÷^])\s*(-?\d+(?:[.,]\d+)?)/,
  );
  if (!expression) return null;

  const expressionOnly = /^-?\d+(?:[.,]\d+)?\s*[+\-*/×x÷^]\s*-?\d+(?:[.,]\d+)?$/.test(
    normalized.replace(/[?!.]/g, "").trim(),
  );
  const asksForMath = /\b(quanto|calcule|calcular|resultado|soma|somar|multiplicar|multiplique|dividir|divida|subtrair|subtraia|conta)\b/.test(
    normalized,
  );

  if (!expressionOnly && !asksForMath) return null;

  const left = Number(expression[1].replace(",", "."));
  const right = Number(expression[3].replace(",", "."));
  const operator = expression[2];
  let result: number;
  let displayOperator = operator;

  switch (operator) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "*":
    case "x":
    case "×":
      result = left * right;
      displayOperator = "×";
      break;
    case "/":
    case "÷":
      if (right === 0) {
        return [
          "🔬 Albert — Cientista & Matemático",
          "",
          "🧮 Raciocínio:",
          "A divisão por zero não tem resultado definido.",
          "",
          "📝 Conclusão:",
          "→ Não é possível dividir por zero.",
        ].join("\n");
      }
      result = left / right;
      displayOperator = "÷";
      break;
    case "^":
      result = left ** right;
      break;
    default:
      return null;
  }

  if (!Number.isFinite(result)) return "Esse resultado fica fora do intervalo que consigo calcular aqui.";

  const formattedLeft = formatNumber(left);
  const formattedRight = formatNumber(right);
  const formattedResult = formatNumber(result);

  return [
    "🔬 Albert — Cientista & Matemático",
    "",
    "📐 Dados:",
    `→ ${formattedLeft} ${displayOperator} ${formattedRight}`,
    "",
    "🧮 Raciocínio:",
    `${formattedLeft} ${displayOperator} ${formattedRight} = ${formattedResult}.`,
    "",
    "📝 Conclusão:",
    `→ ${formattedResult}.`,
  ].join("\n");
}

function explanationReply(question: string): string {
  const normalized = normalizeText(question);
  let steps: string[];
  let summary: string;

  if (normalized.includes("gravidade")) {
    steps = [
      "A gravidade é a atração entre objetos que têm massa.",
      "A Terra atrai os objetos em direção ao seu centro; por isso, quando soltamos uma bola, ela cai.",
      "Pense como um puxão invisível: objetos mais massivos atraem mais, e a atração diminui com a distância.",
    ];
    summary = "A gravidade é o que mantém nossos pés no chão e os planetas em órbita.";
  } else if (normalized.includes("fotossintese")) {
    steps = [
      "A planta absorve água pelas raízes e gás carbônico do ar.",
      "Com a energia da luz, transforma esses ingredientes em açúcar, que usa como alimento.",
      "O oxigênio sobra nesse processo e é liberado no ar.",
    ];
    summary = "A fotossíntese é como uma cozinha: luz como energia, água e gás carbônico como ingredientes.";
  } else if (normalized.includes("probabilidade")) {
    steps = [
      "Probabilidade mede a chance de algo acontecer.",
      "Quando todos os resultados são igualmente possíveis, divida os casos favoráveis pelo total de casos.",
      "Numa moeda justa, há 1 resultado favorável para sair cara entre 2 resultados possíveis: 1/2, ou 50%.",
    ];
    summary = "Probabilidade é uma forma de quantificar a chance, não uma garantia do que vai acontecer.";
  } else if (normalized.includes("derivada")) {
    steps = [
      "A derivada mede o quanto uma quantidade muda em um instante.",
      "Imagine um carro: a posição muda com o tempo, e a derivada da posição é a velocidade naquele momento.",
      "Num gráfico, ela corresponde à inclinação da curva em um ponto.",
    ];
    summary = "Derivada é uma taxa de mudança instantânea, como a velocidade de um carro.";
  } else if (normalized.includes("juros composto")) {
    steps = [
      "Nos juros compostos, cada período acrescenta juros ao valor que já cresceu.",
      "No período seguinte, os juros incidem sobre o valor inicial mais os juros anteriores.",
      "Por isso, com o tempo, o crescimento pode acelerar. Taxa, prazo e valor inicial fazem diferença.",
    ];
    summary = "Juros compostos são juros sobre o saldo acumulado, não apenas sobre o valor inicial.";
  } else if (normalized.includes("inteligencia artificial") || /\bia\b/.test(normalized)) {
    steps = [
      "Um sistema de inteligência artificial aprende padrões a partir de exemplos e dados.",
      "Depois, usa esses padrões para classificar, prever ou gerar conteúdo novo.",
      "Isso não significa que ele entenda o mundo como uma pessoa: pode errar e precisa de verificação.",
    ];
    summary = "IA identifica padrões e os usa para produzir resultados; suas respostas ainda precisam de senso crítico.";
  } else if (normalized.includes("ceu") && normalized.includes("azul")) {
    steps = [
      "A luz do Sol parece branca, mas é formada por várias cores.",
      "Ao atravessar a atmosfera, a luz azul se espalha mais pelo ar do que a luz vermelha.",
      "Essa luz espalhada chega aos nossos olhos de várias direções, e por isso vemos o céu azul durante o dia.",
    ];
    summary = "O céu parece azul porque o ar espalha a luz azul do Sol com mais intensidade.";
  } else {
    steps = [
      "Ainda não identifiquei qual conceito você quer explorar.",
      "Se você disser o nome do assunto, posso começar por uma definição simples e um exemplo do cotidiano.",
    ];
    summary = "Uma boa explicação começa pelo conceito certo; qual tema você quer entender?";
  }

  return [
    "📘 Albert — Explicativo",
    "",
    "Vou te explicar do jeito mais claro possível!",
    "",
    "📖 O que acontece:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "💡 Resumindo:",
    `→ ${summary}`,
  ].join("\n");
}

function createAssistantReply(question: string): string {
  const normalized = normalizeText(question);
  const calculation = calculateAnswer(question);
  if (calculation) return calculation;

  const simpleGreeting = normalized
    .replace(/[!?.,]/g, "")
    .trim()
    .match(/^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|obrigado|obrigada)( albert)?$/);

  if (simpleGreeting) {
    return "Olá! Estou por aqui. Posso explicar um conceito, conferir uma conta ou ajudar a transformar uma ideia em plano. O que você gostaria de fazer?";
  }

  if (/\b(planeje|planejar|organizar|organize|plano|roteiro|passo a passo|me ajuda a|me ajude a)\b/.test(normalized)) {
    return [
      "📋 Albert — Plano de Ação",
      "",
      "Aqui está um caminho simples:",
      "",
      "☐ Passo 1 — Defina o resultado desejado em uma frase.",
      "☐ Passo 2 — Separe o trabalho em etapas pequenas e ordene pelo que depende do quê.",
      "☐ Passo 3 — Escolha uma primeira ação viável e marque quando vai realizá-la.",
      "",
      "✅ Resultado esperado:",
      "→ Um próximo passo claro e possível de começar.",
      "",
      "Se você me disser seu objetivo e prazo, adapto o plano para você.",
    ].join("\n");
  }

  if (/\b(por que|porque|como funciona|me explica|explique|explica|entender|significa|conceito|o que e)\b/.test(normalized)) {
    return explanationReply(question);
  }

  return "Quero te responder com precisão, mas preciso de um pouco mais de contexto. Nesta demonstração local, posso ajudar com contas simples, alguns conceitos de ciência e matemática, e planos em etapas. O que você prefere fazer?";
}

function makeTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 34 ? `${compact.slice(0, 34).trimEnd()}...` : compact;
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="3.2" className="brand-core" />
      <ellipse cx="21" cy="21" rx="16" ry="7" transform="rotate(-34 21 21)" className="brand-orbit" />
      <ellipse cx="21" cy="21" rx="16" ry="7" transform="rotate(34 21 21)" className="brand-orbit brand-orbit-muted" />
      <circle cx="34.7" cy="12" r="2" className="brand-satellite" />
    </svg>
  );
}

function HeroOrbit() {
  return (
    <div className="hero-symbol" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <ellipse cx="60" cy="60" rx="48" ry="20" transform="rotate(-34 60 60)" className="hero-orbit-line" />
        <ellipse cx="60" cy="60" rx="48" ry="20" transform="rotate(34 60 60)" className="hero-orbit-line hero-orbit-line-faint" />
        <ellipse cx="60" cy="60" rx="22" ry="49" className="hero-orbit-line hero-orbit-line-faint" />
        <circle cx="60" cy="60" r="5" className="hero-orbit-core" />
        <g className="orbiting-satellite">
          <circle cx="104" cy="42" r="4.5" className="hero-orbit-satellite" />
        </g>
        <circle cx="19" cy="74" r="3" className="hero-orbit-satellite hero-orbit-satellite-small" />
      </svg>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 9v4.2M10 6.4h.01" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 15.5V4.8M5.8 9l4.2-4.2L14.2 9" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3.5 9h10M9.5 5l4 4-4 4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <rect x="6" y="5" width="8" height="9" rx="1.5" />
      <path d="M11.5 5V3.8a.8.8 0 0 0-.8-.8H4.3a.8.8 0 0 0-.8.8v7.4a.8.8 0 0 0 .8.8H6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  );
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(readConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const messages = activeConversation?.messages ?? [];
  const isTyping = activeConversationId ? pendingIds.has(activeConversationId) : false;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Keep the chat usable when browser storage is unavailable.
    }
  }, [conversations]);

  useEffect(() => {
    const container = conversationRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [activeConversationId, messages.length, isTyping]);

  useEffect(() => {
    if (!aboutOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAboutOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [aboutOpen]);

  function startNewConversation() {
    setActiveConversationId(null);
    setDraft("");
    setSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    setDraft("");
    setSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 148)}px`;
    }
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || isTyping) return;

    const conversationId = activeConversationId ?? createId();
    const userMessage: ChatMessage = { id: createId(), role: "user", content: text };
    const createdAt = Date.now();

    setActiveConversationId(conversationId);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === conversationId);
      const next = exists
        ? current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, userMessage],
                  updatedAt: createdAt,
                }
              : conversation,
          )
        : [
            {
              id: conversationId,
              title: makeTitle(text),
              messages: [userMessage],
              updatedAt: createdAt,
            },
            ...current,
          ];

      return next.sort((left, right) => right.updatedAt - left.updatedAt);
    });

    setPendingIds((current) => new Set(current).add(conversationId));
    window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: createAssistantReply(text),
      };

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, assistantMessage],
                  updatedAt: Date.now(),
                }
              : conversation,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt),
      );
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }, 720);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  }

  function choosePrompt(prompt: string) {
    handleDraftChange(prompt);
    textareaRef.current?.focus();
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      setCopiedMessageId(null);
    }
  }

  const recentConversations = [...conversations].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <BrandMark />
          <div className="brand-copy">
            <span className="brand-name">Albert<span className="brand-period">.</span></span>
            <span className="brand-caption">ASSISTENTE PESSOAL</span>
          </div>
        </div>

        <button className="new-conversation-button" type="button" onClick={startNewConversation}>
          <PlusIcon />
          <span>Nova conversa</span>
        </button>

        <div className="history-section">
          <div className="sidebar-section-title">
            <span>Conversas recentes</span>
            <span className="section-count">{conversations.length > 0 ? conversations.length : ""}</span>
          </div>

          <nav className="history-list" aria-label="Conversas recentes">
            {recentConversations.length > 0 ? (
              recentConversations.slice(0, 8).map((conversation) => (
                <button
                  className={`history-item${conversation.id === activeConversationId ? " history-item-active" : ""}`}
                  type="button"
                  key={conversation.id}
                  aria-current={conversation.id === activeConversationId ? "page" : undefined}
                  onClick={() => selectConversation(conversation.id)}
                >
                  <span className="history-item-dot" aria-hidden="true" />
                  <span className="history-item-title">{conversation.title}</span>
                </button>
              ))
            ) : (
              <p className="empty-history">Suas conversas aparecem aqui.</p>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <span className="footer-status"><span className="status-dot" />Demonstração local</span>
          <p>Suas conversas ficam somente neste navegador.</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="mobile-menu-button"
              type="button"
              aria-label="Abrir menu de conversas"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <MenuIcon />
            </button>
            <div className="breadcrumb" aria-label="Local atual">
              <span className="breadcrumb-root">Albert</span>
              <span className="breadcrumb-slash">/</span>
              <span className="breadcrumb-current">{activeConversation?.title ?? "Nova conversa"}</span>
            </div>
          </div>
          <button className="about-button" type="button" onClick={() => setAboutOpen(true)}>
            <InfoIcon />
            <span>Sobre Albert</span>
          </button>
        </header>

        <main className="chat-layout">
          <div className="conversation-scroll" ref={conversationRef}>
            {messages.length === 0 ? (
              <section className="welcome-stage" aria-labelledby="welcome-heading">
                <div className="welcome-copy">
                  <HeroOrbit />
                  <p className="welcome-eyebrow"><span />CURIOSIDADE COM CLAREZA</p>
                  <h1 className="welcome-heading" id="welcome-heading">
                    <span className="welcome-intro">Olá, eu sou</span>
                    <span className="welcome-name">Albert<span className="welcome-period">.</span></span>
                  </h1>
                  <p className="welcome-description">
                    Seu assistente pessoal para explicar ideias, conferir contas e planejar sem complicar.
                  </p>
                  <p className="welcome-question">No que posso ajudar hoje?</p>
                  <div className="quick-prompts" aria-label="Sugestões de conversa">
                    {quickPrompts.map((item) => (
                      <button
                        type="button"
                        className="quick-prompt"
                        key={item.label}
                        onClick={() => choosePrompt(item.prompt)}
                      >
                        <span>{item.label}</span>
                        <ArrowIcon />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="messages-list" aria-label="Mensagens da conversa">
                {messages.map((message, index) => (
                  <article
                    className={`message-row message-${message.role}`}
                    key={message.id}
                    style={{ animationDelay: `${Math.min(index * 55, 220)}ms` }}
                  >
                    {message.role === "assistant" && (
                      <div className="assistant-avatar" aria-hidden="true"><BrandMark /></div>
                    )}
                    <div className="message-body">
                      {message.role === "assistant" && (
                        <div className="message-author"><span className="author-dot" />Albert</div>
                      )}
                      <div className="message-content">{message.content}</div>
                      {message.role === "assistant" && (
                        <button
                          type="button"
                          className="copy-message-button"
                          onClick={() => void copyMessage(message)}
                          aria-label={copiedMessageId === message.id ? "Resposta copiada" : "Copiar resposta"}
                        >
                          <CopyIcon />
                          <span>{copiedMessageId === message.id ? "Copiado" : "Copiar"}</span>
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {isTyping && (
                  <div className="typing-row" role="status" aria-label="Albert está pensando">
                    <div className="assistant-avatar" aria-hidden="true"><BrandMark /></div>
                    <div className="typing-content">
                      <span className="message-author"><span className="author-dot" />Albert</span>
                      <span className="typing-dots"><i /><i /><i /></span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="composer-zone">
            <div className="composer-wrap">
              <form className="composer-form" onSubmit={handleSubmit}>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  rows={1}
                  aria-label="Sua mensagem para Albert"
                  placeholder="Escreva sua pergunta..."
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />
                <div className="composer-footer">
                  <span className="composer-local-note"><span className="local-note-dot" />Respostas locais</span>
                  <button className="send-button" type="submit" disabled={!draft.trim() || isTyping}>
                    <span>{isTyping ? "Pensando" : "Enviar"}</span>
                    <SendIcon />
                  </button>
                </div>
              </form>
              <p className="composer-hint">Enter para enviar <span>·</span> Shift + Enter para pular linha</p>
            </div>
          </div>
        </main>
      </div>

      {aboutOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAboutOpen(false);
          }}
        >
          <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-heading">
            <div className="dialog-heading-row">
              <div className="dialog-mark"><BrandMark /></div>
              <button className="dialog-close-button" type="button" aria-label="Fechar" onClick={() => setAboutOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <p className="dialog-eyebrow">ASSISTENTE PESSOAL</p>
            <h2 id="about-heading">Pensar junto, com clareza.</h2>
            <p className="dialog-description">
              Albert foi pensado para explicar conceitos, conferir cálculos simples e transformar ideias em próximos passos.
            </p>
            <div className="dialog-disclosure">
              <span className="disclosure-dot" />
              <p>
                Esta é uma demonstração local, sem conexão com um serviço de IA. As respostas são exemplos programados e as conversas ficam neste navegador.
              </p>
            </div>
            <button className="dialog-done-button" type="button" onClick={() => setAboutOpen(false)}>Entendi</button>
          </section>
        </div>
      )}
    </div>
  );
}