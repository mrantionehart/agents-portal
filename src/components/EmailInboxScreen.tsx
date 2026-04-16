'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Archive, Trash2, Search, Plus, Clock } from 'lucide-react';

interface EmailMessage {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  received_date: string;
  read: boolean;
  thread_id: string;
}

interface EmailThread {
  [key: string]: EmailMessage[];
}

export default function EmailInboxScreen() {
  const [threads, setThreads] = useState<EmailMessage[][]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedThread, setSelectedThread] = useState<EmailMessage[] | null>(null);

  useEffect(() => {
    fetchInbox();
  }, [unreadOnly]);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (unreadOnly) params.append('unread', 'true');

      const response = await fetch(`/api/broker/email/inbox?${params}`);
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Error fetching inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search inbox..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              unreadOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thread List */}
        <div className="w-full lg:w-2/5 border-r border-gray-200 overflow-y-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Mail className="w-12 h-12 mb-3 opacity-50" />
              <p>No emails yet</p>
            </div>
          ) : (
            threads.map((thread, idx) => {
              const latestMessage = thread[0];
              const isSelected =
                selectedThread &&
                selectedThread[0]?.thread_id === thread[0]?.thread_id;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedThread(thread)}
                  className={`border-b border-gray-100 p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">
                          {latestMessage.from_email}
                        </p>
                        {!latestMessage.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {latestMessage.subject || '(No subject)'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(latestMessage.received_date)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Detail */}
        <div className="hidden lg:flex lg:w-3/5 flex-col bg-white">
          {selectedThread ? (
            <>
              {/* Detail Header */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedThread[0]?.subject || '(No subject)'}
                    </h2>
                    <p className="text-gray-500 mt-1">
                      From: {selectedThread[0]?.from_email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Archive className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedThread.map((message) => (
                  <div
                    key={message.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {message.from_email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(message.received_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {/* Message body would go here */}
                      <p>Message content</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Section */}
              <div className="border-t border-gray-200 p-6">
                <textarea
                  placeholder="Compose a reply..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                />
                <div className="flex gap-2 mt-3">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Send
                  </button>
                  <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
                    Save Draft
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select an email to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
