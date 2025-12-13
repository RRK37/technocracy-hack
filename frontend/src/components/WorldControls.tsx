/**
 * AI Chat sidebar for the character world
 */

'use client';

import { useState, useCallback } from 'react';
import { PanelRightOpen, Users, Circle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CharacterList } from '@/src/components/CharacterList';
import type { Character } from '@/src/types/character';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/src/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/src/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/src/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/src/components/ai-elements/suggestion';
import { nanoid } from 'nanoid';

type MessageType = {
  id: string;
  from: 'user' | 'assistant';
  content: string;
};

const suggestions = [
  'What are the villagers doing?',
  'Tell me about their behavior',
  'How do they interact?',
  'What makes them unique?',
];

interface WorldControlsProps {
  onAsk: (question: string) => void;
  characters: Character[];
  onClearTrapCircles?: () => void;
  trapCircleCount?: number;
  showInteractionRadius?: boolean;
  onToggleInteractionRadius?: () => void;
  showTrapCircles?: boolean;
  onToggleTrapCircles?: () => void;
}

export function WorldControls({ onAsk, characters, onClearTrapCircles, trapCircleCount = 0, showInteractionRadius = true, onToggleInteractionRadius, showTrapCircles = true, onToggleTrapCircles }: WorldControlsProps) {
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const streamResponse = useCallback(async (messageId: string, content: string) => {
    setStatus('streaming');
    setStreamingMessageId(messageId);

    const words = content.split(' ');
    let currentContent = '';

    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: currentContent } : msg
        )
      );

      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));
    }

    setStatus('ready');
    setStreamingMessageId(null);
  }, []);

  const addUserMessage = useCallback(
    (content: string) => {
      const userMessage: MessageType = {
        id: nanoid(),
        from: 'user',
        content,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Trigger the original onAsk callback for game logic
      onAsk(content);

      // Simulate assistant response
      setTimeout(() => {
        const assistantMessageId = nanoid();
        const assistantMessage: MessageType = {
          id: assistantMessageId,
          from: 'assistant',
          content: '',
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Mock response - in real implementation, this would come from the villagers
        const mockResponse = 'The villagers are responding to your question. You can see their speech bubbles in the world!';
        streamResponse(assistantMessageId, mockResponse);
      }, 500);
    },
    [onAsk, streamResponse]
  );

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);

    if (!hasText) {
      return;
    }

    setStatus('submitted');
    addUserMessage(message.text);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setStatus('submitted');
    addUserMessage(suggestion);
  };

  return (
    <Sidebar side="right" collapsible="offcanvas" className="bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
      <Tabs defaultValue="chat" className="flex flex-col h-full">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3 bg-sidebar space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-normal text-sidebar-foreground">Technocracy</h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{characters.length}</span>
            </div>
          </div>
          {trapCircleCount > 0 && onClearTrapCircles && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Circle className="size-3" />
                <span>{trapCircleCount} trap circle{trapCircleCount !== 1 ? 's' : ''}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTrapCircles}
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
          {onToggleInteractionRadius && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Show Interaction Radius</span>
              <Button
                variant={showInteractionRadius ? "default" : "outline"}
                size="sm"
                onClick={onToggleInteractionRadius}
                className="h-6 px-2 text-xs"
              >
                {showInteractionRadius ? 'On' : 'Off'}
              </Button>
            </div>
          )}
          {onToggleTrapCircles && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Show Trap Circles</span>
              <Button
                variant={showTrapCircles ? "default" : "outline"}
                size="sm"
                onClick={onToggleTrapCircles}
                className="h-6 px-2 text-xs"
              >
                {showTrapCircles ? 'On' : 'Off'}
              </Button>
            </div>
          )}
          <TabsList className="w-full h-8 bg-sidebar-accent">
            <TabsTrigger value="chat" className="flex-1 h-7 text-xs font-normal">
              Chat
            </TabsTrigger>
            <TabsTrigger value="technocrats" className="flex-1 h-7 text-xs font-normal">
              Technocrats
            </TabsTrigger>
          </TabsList>
        </SidebarHeader>

        <SidebarContent className="flex flex-col p-0 bg-sidebar flex-1 overflow-hidden">
          <TabsContent value="chat" className="flex flex-col h-full m-0 data-[state=inactive]:hidden">
            <Conversation className="flex-1 bg-sidebar">
              <ConversationContent className="text-sidebar-foreground">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center px-4">
                    <div className="space-y-2">
                      <p className="text-sm font-normal text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground">Ask the villagers a question to get started</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <Message from={message.from} key={message.id}>
                      <MessageContent className={message.from === 'assistant' ? 'text-sidebar-foreground' : ''}>
                        <MessageResponse>{message.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="shrink-0 divide-y divide-sidebar-border bg-sidebar">
              <Suggestions className="px-4 py-3">
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    suggestion={suggestion}
                    className="text-sidebar-foreground"
                  />
                ))}
              </Suggestions>

              <div className="px-4 py-3 bg-sidebar">
                <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                  <PromptInputHeader>
                    <PromptInputAttachments>
                      {(attachment) => <PromptInputAttachment data={attachment} />}
                    </PromptInputAttachments>
                  </PromptInputHeader>
                  <PromptInputBody>
                    <PromptInputTextarea
                      placeholder="Ask the villagers something..."
                      className="text-sidebar-foreground placeholder:text-muted-foreground bg-sidebar-accent"
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>
                    </PromptInputTools>
                    <PromptInputSubmit
                      disabled={status === 'streaming'}
                      status={status}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="technocrats" className="h-full m-0 data-[state=inactive]:hidden">
            <CharacterList characters={characters} />
          </TabsContent>
        </SidebarContent>
      </Tabs>
    </Sidebar>
  );
}

export function SidebarToggleButton() {
  const { open } = useSidebar();

  if (open) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <SidebarTrigger asChild>
        <Button variant="outline" size="icon" className="shadow-lg">
          <PanelRightOpen className="size-4" />
        </Button>
      </SidebarTrigger>
    </div>
  );
}
