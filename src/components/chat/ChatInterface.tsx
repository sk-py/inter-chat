import type React from "react";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEventHandler,
} from "react";
import { nanoid } from "nanoid";
import { marked } from "marked";
import DOMPurify from "dompurify";

// --- UI Components ---
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/shadcn-io/ai/conversation";
import { Loader } from "@/components/ui/shadcn-io/ai/loader";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/shadcn-io/ai/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ui/shadcn-io/ai/prompt-input";
import { PaperclipIcon, RotateCcwIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// --- Message Structure ---
interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
}

const Chatbot: React.FC = () => {
  // --- State Management ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: "Hello! How can I help you today?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => nanoid()); // Generate sessionId on mount

  const conversationContentRef = useRef<HTMLDivElement>(null);

  // --- Backend Configuration ---
  // const BASE_URL = "http://localhost:3000";
  const BASE_URL = "https://actibot.vercel.app";

  // --- Auto-scroll to the bottom of the messages ---
  useEffect(() => {
    if (conversationContentRef.current) {
      conversationContentRef.current.scrollTop =
        conversationContentRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Core function to handle sending messages and receiving streams ---
  const handleSendMessage: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();
      const textToSend = inputMessage.trim();
      if (!textToSend || isTyping) return;

      const userMessage: ChatMessage = {
        id: nanoid(),
        content: textToSend,
        role: "user",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");
      setIsTyping(true);

      const botMessageId = nanoid();
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
          isStreaming: true,
        },
      ]);

      try {
        const response = await fetch(`${BASE_URL}/api/bot/user-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({ query: textToSend, sessionId }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to fetch bot response");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === "chunk") {
                accumulatedResponse += data.data;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, content: accumulatedResponse }
                      : msg
                  )
                );
              } else if (data.type === "complete") {
                console.log(`Stream finished: ${data.data.finishReason}`);
              }
            } catch (error) {
              console.error("Error parsing stream chunk:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching streamed response:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  content: "Sorry, something went wrong. Please try again.",
                }
              : msg
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsTyping(false);
      }
    },
    [inputMessage, isTyping, sessionId]
  );

  // --- Function to reset the chat ---
  const handleReset = useCallback(() => {
    setMessages([
      {
        id: "1",
        content: "Hello! I'm back to help. What can I do for you?",
        role: "assistant",
        timestamp: new Date(),
      },
    ]);
    setInputMessage("");
    setIsTyping(false);
    setSessionId(nanoid()); 
  }, []);

  // --- Sanitize and parse markdown for rendering ---
  const renderMarkdown = (content: string) => {
    const rawMarkup = marked.parse(content, { async: false });
    return { __html: DOMPurify.sanitize(rawMarkup as string) };
  };

  return (
    // --- Main Chatbot Window ---

    <div className="h-[92vh] sm:max-w-6xl mx-auto border max-sm:border-b-0 sm:h-[90vh] sm:my-[5vh] w-full flex flex-col justify-center sm:rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center sm:rounded-t-2xl overflow-hidden justify-between border-b bg-gray-400/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* <div className="size-2.5 rounded-full bg-green-500" /> */}
            <img
              src="/actibot.png"
              alt="Actibot Logo"
              className="h-8 w-8 bg-white rounded-sm"
            />  
            <span className="font-medium text-sm">ActiBot</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 px-2"
        >
          <RotateCcwIcon className="size-4" />
          <span className="ml-1.5 text-xs">Reset</span>
        </Button>
      </div>

      {/* Conversation Area - This now flexes to fill available space */}
      <Conversation className="flex-1">
        <ConversationContent
          // ref={conversationContentRef}
          className=""
        >
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.isStreaming && message.content === "" ? (
                  <div className="flex items-center gap-2">
                    <Loader size={14} />
                    <span className="text-muted-foreground text-sm">
                      Thinking...
                    </span>
                  </div>
                ) : (
                  <div
                    className="text-left"
                    dangerouslySetInnerHTML={renderMarkdown(message.content)}
                  />
                )}
              </MessageContent>
              <MessageAvatar
                src={message.role === "user" ? "/user.webp" : "/actibot.png"}
                name={message.role === "user" ? "User" : "AI"}
              />
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area - Stays at the bottom */}
      <div className="border-t p-4 pb-2">
        <PromptInput onSubmit={handleSendMessage}>
          <PromptInputTextarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isTyping}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                handleSendMessage(e as any);
              }
            }}
          />
          <PromptInputToolbar>
            <Tooltip>
              <TooltipTrigger>
                <PromptInputButton>
                  <PaperclipIcon size={16} />
                  <TooltipContent>
                    <p>File upload coming soon!</p>
                  </TooltipContent>
                </PromptInputButton>
              </TooltipTrigger>
            </Tooltip>
            <PromptInputSubmit
              disabled={!inputMessage.trim() || isTyping}
              status={isTyping ? "streaming" : "ready"}
            />
          </PromptInputToolbar>
        </PromptInput>
        <div className="text-center text-xs text-muted-foreground pt-2">
          Powered by <b>Dextero</b>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
