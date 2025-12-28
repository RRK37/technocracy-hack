/**
 * AI Chat sidebar for the character world
 */

'use client';

import { useState, useCallback } from 'react';
import { PanelRightOpen, Users, Circle, Trash2, Eye, Zap, FlaskConical, Presentation, MessageCircle, Rocket, Play, SkipForward, ArrowLeft, Layers } from 'lucide-react';
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
import { WorldMode, ModeFeatures, PitchStage } from '@/src/lib/world';
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
  worldMode: WorldMode;
  onSetWorldMode: (mode: WorldMode) => void;
  modeConfig: ModeFeatures;
  pitchStage?: PitchStage;
  onAdvancePitchStage?: () => void;
  onBack?: () => void;
  scriptPlan?: string | null;
  displayedChunks?: string[];
  isLoadingScript?: boolean;
}

export function WorldControls({ onAsk, characters, onClearTrapCircles, trapCircleCount = 0, showInteractionRadius = true, onToggleInteractionRadius, showTrapCircles = true, onToggleTrapCircles, worldMode, onSetWorldMode, modeConfig, pitchStage, onAdvancePitchStage, onBack, scriptPlan, displayedChunks = [], isLoadingScript = false }: WorldControlsProps) {
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
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <h2 className="text-sm font-normal text-sidebar-foreground">Technocracy</h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{characters.length}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">World Mode</span>
            {/* Row 1: Core modes */}
            <div className="flex gap-1">
              <Button
                variant={worldMode === WorldMode.INTERACTIVE ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.INTERACTIVE)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.INTERACTIVE ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-transparent'}`}
              >
                <Zap className="size-3 mr-1" />
                Interactive
              </Button>
              <Button
                variant={worldMode === WorldMode.OBSERVE ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.OBSERVE)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.OBSERVE ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-transparent'}`}
              >
                <Eye className="size-3 mr-1" />
                Observe
              </Button>
            </div>
            {/* Row 2: Special modes */}
            <div className="flex flex-wrap gap-1">
              <Button
                variant={worldMode === WorldMode.PRESENTING ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.PRESENTING)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.PRESENTING ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-transparent'}`}
              >
                <Presentation className="size-3 mr-1" />
                Presenting
              </Button>
              <Button
                variant={worldMode === WorldMode.DISCUSS ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.DISCUSS)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.DISCUSS ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-transparent'}`}
              >
                <MessageCircle className="size-3 mr-1" />
                Discuss
              </Button>
              <Button
                variant={worldMode === WorldMode.SCRATCH ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.SCRATCH)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.SCRATCH ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-transparent'}`}
              >
                <FlaskConical className="size-3 mr-1" />
                Scratch
              </Button>
              <Button
                variant={worldMode === WorldMode.PITCH ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.PITCH)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.PITCH ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-transparent'}`}
              >
                <Rocket className="size-3 mr-1" />
                Pitch
              </Button>
              <Button
                variant={worldMode === WorldMode.ABSTRACT_LAYERS ? "default" : "outline"}
                size="sm"
                onClick={() => onSetWorldMode(WorldMode.ABSTRACT_LAYERS)}
                className={`h-6 px-2 text-xs ${worldMode === WorldMode.ABSTRACT_LAYERS ? 'bg-pink-600 hover:bg-pink-700 text-white' : 'bg-transparent'}`}
              >
                <Layers className="size-3 mr-1" />
                Abstract Layers
              </Button>
            </div>
          </div>
          {/* Pitch mode controls */}
          {worldMode === WorldMode.PITCH && onAdvancePitchStage && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Stage: {pitchStage === PitchStage.IDLE ? 'Ready' : pitchStage === PitchStage.PRESENTING ? 'Presenting' : 'Agents are talking about you'}
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={onAdvancePitchStage}
                className="h-6 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {pitchStage === PitchStage.IDLE ? (
                  <><Play className="size-3 mr-1" /> Start Pitching</>
                ) : (
                  <><SkipForward className="size-3 mr-1" /> Next</>
                )}
              </Button>
            </div>
          )}
          {/* Script display for PITCH mode */}
          {worldMode === WorldMode.PITCH && pitchStage === PitchStage.PRESENTING && (
            <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              {/* Script Plan */}
              {isLoadingScript && !scriptPlan && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Generating pitch plan...</span>
                </div>
              )}
              {scriptPlan && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide">Pitch Plan</h4>
                  <div className="max-h-32 overflow-y-auto">
                    <p className="text-xs text-gray-300 leading-relaxed">{scriptPlan}</p>
                  </div>
                </div>
              )}
              {/* Script chunks */}
              {displayedChunks.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-gray-700">
                  <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide">Script</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {displayedChunks.map((chunk, i) => (
                      <p key={i} className="text-sm text-gray-200 leading-relaxed animate-fadeIn">
                        {chunk}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {isLoadingScript && scriptPlan && !displayedChunks.length && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Generating script...</span>
                </div>
              )}
            </div>
          )}
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
          {modeConfig.interactionRadius && onToggleInteractionRadius && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Show Interaction Radius</span>
              <Button
                variant={showInteractionRadius ? "default" : "outline"}
                size="sm"
                onClick={onToggleInteractionRadius}
                className={`h-6 px-2 text-xs ${showInteractionRadius ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-transparent'}`}
              >
                {showInteractionRadius ? 'On' : 'Off'}
              </Button>
            </div>
          )}
          {modeConfig.trapCircles && onToggleTrapCircles && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Show Trap Circles</span>
              <Button
                variant={showTrapCircles ? "default" : "outline"}
                size="sm"
                onClick={onToggleTrapCircles}
                className={`h-6 px-2 text-xs ${showTrapCircles ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-transparent'}`}
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
              {/* Hide prompt input in PITCH mode */}
              {worldMode !== WorldMode.PITCH && (
                <>
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
                </>
              )}
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
