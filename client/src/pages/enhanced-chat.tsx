import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmojiPicker from "@/components/EmojiPicker";
import GifPicker from "@/components/GifPicker";
import FileUploader from "@/components/FileUploader";
import ThemeSelector from "@/components/ThemeSelector";
import { Send, Edit, Trash2, LogOut, Users, Settings } from "lucide-react";
import { format, formatDistance } from "date-fns";
import type { Message, User, ChatTheme } from "@shared/schema";

interface EnhancedChatPageProps {
  currentUser: User;
  onSignOut: () => void;
}

export default function EnhancedChatPage({ currentUser, onSignOut }: EnhancedChatPageProps) {
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedGif, setSelectedGif] = useState<{url: string, name: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 2000,
  });

  // Get current theme
  const { data: currentTheme } = useQuery<ChatTheme>({
    queryKey: ['/api/chat/theme'],
    retry: false,
  });

  // Get online users count
  const { data: usersCount = 0 } = useQuery<number>({
    queryKey: ["/api/users/count"],
    refetchInterval: 10000,
  });

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (messageData: {
      content: string;
      username: string;
      userId: number;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'file' | 'gif';
      attachmentName?: string;
    }) => {
      const response = await apiRequest("POST", "/api/messages", messageData);
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      setSelectedFile(null);
      setSelectedGif(null);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      scrollToBottom();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Could not send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update message mutation
  const updateMessageMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const response = await apiRequest("PATCH", `/api/messages/${id}`, { content });
      return response.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Message updated!",
        description: "Your message has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update message",
        description: error.message || "Could not update message.",
        variant: "destructive",
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/messages/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Message deleted!",
        description: "Your message has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Could not delete message.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Apply theme when it changes
  useEffect(() => {
    if (currentTheme) {
      const root = document.documentElement;
      root.style.setProperty('--chat-primary', currentTheme.primaryColor);
      root.style.setProperty('--chat-secondary', currentTheme.secondaryColor);
      root.style.setProperty('--chat-background', currentTheme.backgroundColor);
      root.style.setProperty('--chat-message-self', currentTheme.messageBackgroundSelf);
      root.style.setProperty('--chat-message-other', currentTheme.messageBackgroundOther);
      root.style.setProperty('--chat-text', currentTheme.textColor);
      document.body.style.backgroundColor = currentTheme.backgroundColor;
    }
  }, [currentTheme]);

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedFile && !selectedGif)) return;

    let attachmentUrl = "";
    let attachmentType: 'image' | 'file' | 'gif' | undefined;
    let attachmentName = "";

    // Handle file upload (simplified - in real app would upload to cloud storage)
    if (selectedFile) {
      // For demo, using data URL - in production should upload to cloud
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          attachmentUrl = reader.result as string;
          attachmentType = 'image';
          attachmentName = selectedFile.name;
          sendMessage();
        };
        reader.readAsDataURL(selectedFile);
        return;
      } else {
        attachmentUrl = `file://${selectedFile.name}`;
        attachmentType = 'file';
        attachmentName = selectedFile.name;
      }
    }

    if (selectedGif) {
      attachmentUrl = selectedGif.url;
      attachmentType = 'gif';
      attachmentName = selectedGif.name;
    }

    sendMessage();

    function sendMessage() {
      createMessageMutation.mutate({
        content: message.trim() || (selectedFile ? `Shared: ${selectedFile.name}` : selectedGif?.name || ""),
        username: `${currentUser.firstName} ${currentUser.lastName}`,
        userId: currentUser.id,
        attachmentUrl: attachmentUrl || undefined,
        attachmentType: attachmentType,
        attachmentName: attachmentName || undefined,
      });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handleGifSelect = (gifUrl: string, gifName: string) => {
    setSelectedGif({ url: gifUrl, name: gifName });
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const startEdit = (id: number, content: string) => {
    setEditingId(id);
    setEditingMessage(content);
  };

  const saveEdit = () => {
    if (editingId && editingMessage.trim()) {
      updateMessageMutation.mutate({
        id: editingId,
        content: editingMessage.trim(),
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingMessage("");
  };

  const deleteMessage = (id: number) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(id);
    }
  };

  const clearAttachments = () => {
    setSelectedFile(null);
    setSelectedGif(null);
  };

  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ 
        backgroundColor: currentTheme?.backgroundColor || '#f8fafc',
        color: currentTheme?.textColor || '#1e293b'
      }}
    >
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0 shadow-md">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: currentTheme?.primaryColor || '#3b82f6' }}
                >
                  💬
                </div>
                <CardTitle className="text-xl">Chat Room</CardTitle>
              </div>
              
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {usersCount} online
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <ThemeSelector currentTheme={currentTheme} />
              
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs">
                    {currentUser.firstName[0]}{currentUser.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
              </div>

              <Button variant="outline" size="sm" onClick={onSignOut}>
                <LogOut className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages Area */}
      <div className="flex-1 p-4 max-w-4xl mx-auto">
        <Card className="h-[calc(100vh-200px)] shadow-lg">
          <CardContent className="p-0 h-full flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <div className="text-4xl mb-2">💬</div>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwnMessage = msg.userId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} group`}
                      >
                        <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
                          {!isOwnMessage && (
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs">
                                  {msg.username.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium text-gray-600">
                                {msg.username}
                              </span>
                            </div>
                          )}
                          
                          <div
                            className={`relative p-3 rounded-2xl shadow-sm ${
                              isOwnMessage ? "text-white" : ""
                            }`}
                            style={{
                              backgroundColor: isOwnMessage 
                                ? currentTheme?.messageBackgroundSelf || '#3b82f6'
                                : currentTheme?.messageBackgroundOther || '#e2e8f0',
                              color: isOwnMessage 
                                ? '#ffffff' 
                                : currentTheme?.textColor || '#1e293b'
                            }}
                          >
                            {editingId === msg.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingMessage}
                                  onChange={(e) => setEditingMessage(e.target.value)}
                                  className="text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={saveEdit} disabled={updateMessageMutation.isPending}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Attachment Display */}
                                {msg.attachmentUrl && (
                                  <div className="mb-2">
                                    {msg.attachmentType === 'image' ? (
                                      <img
                                        src={msg.attachmentUrl}
                                        alt={msg.attachmentName || "Shared image"}
                                        className="max-w-full h-auto rounded-lg"
                                      />
                                    ) : msg.attachmentType === 'gif' ? (
                                      <img
                                        src={msg.attachmentUrl}
                                        alt={msg.attachmentName || "Shared GIF"}
                                        className="max-w-full h-auto rounded-lg"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                                        <div className="text-gray-600">📄</div>
                                        <span className="text-sm">{msg.attachmentName}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="text-sm leading-relaxed">
                                  {msg.content}
                                </div>
                              </>
                            )}

                            {/* Message actions */}
                            {isOwnMessage && editingId !== msg.id && (
                              <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 bg-white shadow-md hover:bg-gray-50"
                                  onClick={() => startEdit(msg.id, msg.content)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 bg-white shadow-md hover:bg-gray-50 text-red-500 hover:text-red-600"
                                  onClick={() => deleteMessage(msg.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className={`mt-1 text-xs text-gray-500 ${isOwnMessage ? "text-right" : ""}`}>
                            {formatDistance(new Date(msg.createdAt), new Date(), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <Separator />

            {/* Attachment Preview */}
            {(selectedFile || selectedGif) && (
              <div className="p-3 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  {selectedFile && (
                    <div className="flex items-center gap-2">
                      <div className="text-blue-500">
                        {selectedFile.type.startsWith('image/') ? '🖼️' : '📄'}
                      </div>
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedFile.type.startsWith('image/') ? 'Image' : 'File'}
                      </Badge>
                    </div>
                  )}
                  
                  {selectedGif && (
                    <div className="flex items-center gap-2">
                      <img src={selectedGif.url} alt={selectedGif.name} className="w-12 h-8 object-cover rounded" />
                      <span className="text-sm font-medium">{selectedGif.name}</span>
                      <Badge variant="secondary" className="text-xs">GIF</Badge>
                    </div>
                  )}
                  
                  <Button size="sm" variant="ghost" onClick={clearAttachments}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                    <GifPicker onGifSelect={handleGifSelect} />
                    <FileUploader onFileSelect={handleFileSelect} />
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={createMessageMutation.isPending}
                      className="min-h-[40px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={createMessageMutation.isPending || (!message.trim() && !selectedFile && !selectedGif)}
                      style={{ backgroundColor: currentTheme?.primaryColor || '#3b82f6' }}
                      className="text-white hover:opacity-90"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}