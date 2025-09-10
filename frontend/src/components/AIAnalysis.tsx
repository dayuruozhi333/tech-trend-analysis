import React, { useState, useRef, useEffect } from 'react';
import { requestAIAnalysis, AIAnalysisRequest } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIAnalysisProps {
    content: string;
    type: 'topics' | 'trends' | 'map' | 'general';
    className?: string;
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({ content, type, className = '' }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [error, setError] = useState<string>('');
    const resultRef = useRef<HTMLDivElement>(null);

    const handleAnalysis = async () => {
        if (!content.trim()) {
            setError('没有可分析的内容');
            return;
        }

        setIsAnalyzing(true);
        setError('');
        setAnalysisResult('');

        try {
            const request: AIAnalysisRequest = {
                content: content.trim(),
                type: type
            };

            console.log('发送AI分析请求:', request); // 调试日志

            const stream = await requestAIAnalysis(request);
            if (!stream) {
                throw new Error('无法获取分析流');
            }

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // 处理完整的行
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留最后一个不完整的行

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const dataStr = line.slice(6).trim();
                            if (dataStr === '[DONE]') {
                                break;
                            }

                            const data = JSON.parse(dataStr);
                            if (data.content) {
                                setAnalysisResult(prev => prev + data.content);
                                // 自动滚动到底部
                                setTimeout(() => {
                                    if (resultRef.current) {
                                        resultRef.current.scrollTop = resultRef.current.scrollHeight;
                                    }
                                }, 10);
                            } else if (data.error) {
                                setError(data.error);
                                break;
                            }
                        } catch (e) {
                            console.warn('JSON解析错误:', e, '原始数据:', line);
                            // 忽略JSON解析错误，继续处理
                            continue;
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error('AI分析错误:', err);
            setError(err.message || 'AI分析失败');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const clearResult = () => {
        setAnalysisResult('');
        setError('');
    };

    return (
        <div className={`ai-analysis-container ${className}`} style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <button
                    onClick={handleAnalysis}
                    disabled={isAnalyzing || !content.trim()}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: isAnalyzing ? '#f3f4f6' : '#ffffff',
                        color: isAnalyzing ? '#6b7280' : '#111827',
                        cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        if (!isAnalyzing) {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#9ca3af';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isAnalyzing) {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#d1d5db';
                        }
                    }}
                >
                    {isAnalyzing ? (
                        <>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                border: '2px solid #6b7280',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            正在思考中...
                        </>
                    ) : (
                        'AI分析'
                    )}
                </button>

                {analysisResult && (
                    <button
                        onClick={clearResult}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            color: '#6b7280',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        清除结果
                    </button>
                )}
            </div>

            {error && (
                <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '14px',
                    marginBottom: '12px'
                }}>
                    ❌ {error}
                </div>
            )}

            {analysisResult && (
                <div
                    ref={resultRef}
                    style={{
                        padding: '16px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#1e293b',
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #e2e8f0'
                    }}>
                        <span style={{ fontSize: '16px' }}>🤖</span>
                        <span style={{ fontWeight: '600', color: '#1e293b' }}>AI分析结果</span>
                    </div>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '16px 0 8px 0', color: '#1e293b' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '14px 0 6px 0', color: '#1e293b' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '12px 0 4px 0', color: '#1e293b' }}>{children}</h3>,
                            h4: ({ children }) => <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0 4px 0', color: '#1e293b' }}>{children}</h4>,
                            p: ({ children }) => <p style={{ margin: '8px 0', lineHeight: '1.6' }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                            strong: ({ children }) => <strong style={{ fontWeight: 'bold', color: '#1e293b' }}>{children}</strong>,
                            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                            code: ({ children }) => <code style={{
                                background: '#f1f5f9',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                fontSize: '13px',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                            }}>{children}</code>,
                            pre: ({ children }) => <pre style={{
                                background: '#f1f5f9',
                                padding: '12px',
                                borderRadius: '6px',
                                overflow: 'auto',
                                margin: '8px 0',
                                fontSize: '13px',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                            }}>{children}</pre>,
                            blockquote: ({ children }) => <blockquote style={{
                                borderLeft: '4px solid #e2e8f0',
                                paddingLeft: '16px',
                                margin: '8px 0',
                                color: '#64748b',
                                fontStyle: 'italic'
                            }}>{children}</blockquote>,
                            table: ({ children }) => <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                margin: '8px 0',
                                fontSize: '14px'
                            }}>{children}</table>,
                            th: ({ children }) => <th style={{
                                border: '1px solid #e2e8f0',
                                padding: '8px 12px',
                                background: '#f8fafc',
                                textAlign: 'left',
                                fontWeight: 'bold'
                            }}>{children}</th>,
                            td: ({ children }) => <td style={{
                                border: '1px solid #e2e8f0',
                                padding: '8px 12px'
                            }}>{children}</td>,
                        }}
                    >
                        {analysisResult}
                    </ReactMarkdown>
                </div>
            )}

            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};
