"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type ChatMsg = { id: string; role: "user" | "assistant"; content: string }

function makeId() {
  return Math.random().toString(36).slice(2)
}

function getAssistantReply(userText: string) {
  const t = userText.toLowerCase()

  // Simple “inventory optimization” canned logic (replace later with real AI)
  if (t.includes("overstock")) {
    return [
      `Here are a few **Opportunities** to reduce overstock this quarter:`,
      `1) **Pull-in** demand where feasible (advance customer orders / internal consumption).`,
      `2) **Cancel** or **defer** open POs for low-turn SKUs with excess coverage.`,
      `3) Rebalance: move stock to sites with higher consumption, and tighten reorder points.`,
      ``,
      `Want the full list?`,
    ].join("\n")
  }

  return [
    `I can propose **Opportunities** based on your question.`,
    `Try asking: “What’s the strategy to lower the overstock this quarter?”`,
  ].join("\n")
}

export function FloatingAIChat() {
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<ChatMsg[]>([
    {
      id: makeId(),
      role: "assistant",
      content:
        "Ask me about inventory optimization. I’ll propose **Opportunities** you can review and execute.",
    },
  ])

  const onSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg: ChatMsg = { id: makeId(), role: "user", content: trimmed }
    const assistantMsg: ChatMsg = {
      id: makeId(),
      role: "assistant",
      content: getAssistantReply(trimmed),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="h-12 rounded-full shadow-lg">
            <Bot className="mr-2 h-5 w-5" />
            AI Chat
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>Inventory AI</SheetTitle>
            <SheetDescription>
              Ask questions and get recommended “Opportunities”.
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-4 h-[calc(100vh-220px)] overflow-y-auto space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={[
                  "rounded-xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-10 bg-muted"
                    : "mr-10 bg-background border",
                ].join(" ")}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {m.role === "assistant" && m.content.includes("Want the full list?") && (
                  <div className="mt-3">
                    <SheetClose asChild>
                      <Link href="/opportunities">
                        <Button variant="secondary" className="h-9">
                          See all opportunities
                        </Button>
                      </Link>
                    </SheetClose>
                  </div>
                )}
              </div>
            ))}
          </div>

          <SheetFooter className="px-6 pb-6">
            <div className="w-full space-y-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., What's the strategy to lower the overstock this quarter?"
                className="min-h-[80px]"
              />
              <div className="flex justify-end">
                <Button onClick={onSend} className="h-9">
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
