import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { type UIMessage } from "@/lib/types";
import { nanoid } from "nanoid";

export const useStreamingChat = (apiEndpoint: string = "/api/chat") => {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: UIMessage = {
      id: nanoid(),
      role: "user",
      parts: [{ type: "text", text: input }],
    };
    // @ts-ignore
    const newMessages = [...messages, userMessage];
    // @ts-ignore
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(response.statusText || "Failed to fetch stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (isFirstChunk) {
          isFirstChunk = false;
          // @ts-ignore
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              role: "assistant",
              parts: [{ type: "text", text: chunk }],
            },
          ]);
        } else {
          // @ts-ignore
          setMessages((prev) => {
            // @ts-ignore
            const lastMessage = prev[prev.length - 1];
            const updatedText = lastMessage.parts.text + chunk;
            const updatedLastMessage = {
              ...lastMessage,
              parts: [{ ...lastMessage.parts, text: updatedText }],
            };
            // @ts-ignore
            return [...prev.slice(0, -1), updatedLastMessage];
          });
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err as Error);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return {
    messages,
    input,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    stop,
  };
};
