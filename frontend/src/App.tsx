import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Activity, 
  Wrench, 
  FileText, 
  Terminal, 
  Cpu, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  HelpCircle, 
  Send, 
  RefreshCw, 
  Database,
  ArrowRight,
  Info
} from 'lucide-react';
import { McpClient, ConnectionStatus, LogMessage } from './mcpClient';

// CSS class mapping helper for status
const getStatusClass = (status: ConnectionStatus) => `status-${status}`;

export default function App() {
  const [sseUrl, setSseUrl] = useState('http://127.0.0.1:8000/sse');
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  
  // Discoveries
  const [tools, setTools] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  
  // Active selection
  const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
  const [selectedItem, setSelectedItem] = useState<{
    type: 'tool' | 'resource' | 'prompt';
    data: any;
  } | null>(null);

  // Form values for the execution panel
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  // Execution state
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const clientRef = useRef<McpClient | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  const handleConnect = async () => {
    if (status === 'CONNECTED' || status === 'CONNECTING' || status === 'INITIALIZING') {
      return;
    }

    setLogs([]);
    setSelectedItem(null);
    setTools([]);
    setResources([]);
    setPrompts([]);
    setExecutionResult(null);
    setExecutionError(null);

    const client = new McpClient(sseUrl);
    clientRef.current = client;

    client.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    client.onLog((logMsg) => {
      setLogs((prev) => [...prev.slice(-99), logMsg]);
    });

    try {
      await client.connect();
      // On connection, retrieve lists
      await refreshLists();
    } catch (e: any) {
      // Errors are already handled by the client callbacks
      console.error('Failed to connect:', e);
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus('DISCONNECTED');
    setSelectedItem(null);
  };

  const refreshLists = async () => {
    if (!clientRef.current || status !== 'CONNECTED') return;
    
    try {
      const toolsRes = await clientRef.current.listTools();
      setTools(toolsRes?.tools || []);
    } catch (e: any) {
      clientRef.current.onLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        direction: 'system',
        content: `Error loading tools: ${e.message || JSON.stringify(e)}`
      });
    }

    try {
      const resourcesRes = await clientRef.current.listResources();
      setResources(resourcesRes?.resources || []);
    } catch (e: any) {
      clientRef.current.onLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        direction: 'system',
        content: `Error loading resources: ${e.message || JSON.stringify(e)}`
      });
    }

    try {
      const promptsRes = await clientRef.current.listPrompts();
      setPrompts(promptsRes?.prompts || []);
    } catch (e: any) {
      clientRef.current.onLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        direction: 'system',
        content: `Error loading prompts: ${e.message || JSON.stringify(e)}`
      });
    }
  };

  const selectItem = (type: 'tool' | 'resource' | 'prompt', data: any) => {
    setSelectedItem({ type, data });
    setExecutionResult(null);
    setExecutionError(null);
    
    // Initialize form defaults
    const defaults: Record<string, any> = {};
    if (type === 'tool') {
      const props = data.inputSchema?.properties || {};
      Object.keys(props).forEach((key) => {
        if (props[key].default !== undefined) {
          defaults[key] = props[key].default;
        } else if (props[key].type === 'boolean') {
          defaults[key] = false;
        } else if (props[key].enum && props[key].enum.length > 0) {
          defaults[key] = props[key].enum[0];
        } else {
          defaults[key] = '';
        }
      });
    } else if (type === 'prompt') {
      const args = data.arguments || [];
      args.forEach((arg: any) => {
        defaults[arg.name] = '';
      });
    }
    setFormValues(defaults);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const executeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientRef.current || !selectedItem) return;

    setExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);

    try {
      if (selectedItem.type === 'tool') {
        // Cast arguments appropriately based on schema
        const castedArgs: Record<string, any> = {};
        const props = selectedItem.data.inputSchema?.properties || {};
        
        Object.keys(formValues).forEach((key) => {
          const schemaProp = props[key];
          const val = formValues[key];

          if (val === '' || val === undefined) {
            return; // Skip empty inputs unless required validation triggers it
          }

          if (schemaProp) {
            if (schemaProp.type === 'number' || schemaProp.type === 'integer') {
              castedArgs[key] = Number(val);
            } else if (schemaProp.type === 'boolean') {
              castedArgs[key] = Boolean(val);
            } else {
              castedArgs[key] = val;
            }
          } else {
            castedArgs[key] = val;
          }
        });

        const response = await clientRef.current.callTool(selectedItem.data.name, castedArgs);
        
        // Pretty print results
        if (response.isError) {
          setExecutionError(response.message || JSON.stringify(response));
        } else if (response.content) {
          const textContents = response.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n\n');
          setExecutionResult(textContents || JSON.stringify(response, null, 2));
        } else {
          setExecutionResult(JSON.stringify(response, null, 2));
        }
      } else if (selectedItem.type === 'resource') {
        const response = await clientRef.current.readResource(selectedItem.data.uri);
        
        if (response.contents && response.contents.length > 0) {
          const contents = response.contents.map((c: any) => c.text).join('\n\n');
          setExecutionResult(contents);
        } else {
          setExecutionResult(JSON.stringify(response, null, 2));
        }
      } else if (selectedItem.type === 'prompt') {
        const response = await clientRef.current.getPrompt(selectedItem.data.name, formValues);
        setExecutionResult(JSON.stringify(response, null, 2));
      }
    } catch (err: any) {
      setExecutionError(err.message || JSON.stringify(err));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel app-header">
        <div className="brand-section">
          <div className="logo-icon">
            <Cpu size={24} color="#fff" />
          </div>
          <div className="brand-title-group">
            <h1>Model Context Protocol Playground</h1>
            <p>Vite + FastAPI SSE Transport Client</p>
          </div>
        </div>

        <div className="connection-bar">
          <div className={`status-badge ${getStatusClass(status)}`}>
            <span className={`status-dot ${status !== 'DISCONNECTED' && status !== 'ERROR' ? 'animate-pulse' : ''}`} />
            <span>{status}</span>
          </div>

          <input
            type="text"
            className="connection-input"
            value={sseUrl}
            onChange={(e) => setSseUrl(e.target.value)}
            placeholder="http://localhost:8000/sse"
            disabled={status !== 'DISCONNECTED' && status !== 'ERROR'}
          />

          {status === 'DISCONNECTED' || status === 'ERROR' ? (
            <button className="btn btn-primary" onClick={handleConnect}>
              <Play size={14} /> Connect
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleDisconnect}>
              <Square size={14} /> Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="workspace-grid">
        {/* Discovery Panel */}
        <section className="glass-panel workspace-col">
          <div className="col-header">
            <h2>Discovery Explorer</h2>
            {status === 'CONNECTED' && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={refreshLists}
                title="Refresh Discoveries"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>

          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              <Wrench size={14} /> Tools <span className="badge-count">{tools.length}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
              onClick={() => setActiveTab('resources')}
            >
              <Database size={14} /> Resources <span className="badge-count">{resources.length}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              <FileText size={14} /> Prompts <span className="badge-count">{prompts.length}</span>
            </button>
          </div>

          <div className="col-content">
            {status !== 'CONNECTED' ? (
              <div className="empty-state">
                <Activity size={24} className="empty-icon" />
                <p>Connect to an MCP server to explore its available tools, resources, and templates.</p>
              </div>
            ) : activeTab === 'tools' ? (
              tools.length === 0 ? (
                <div className="empty-state"><p>No tools registered on the server.</p></div>
              ) : (
                tools.map((t) => (
                  <button
                    key={t.name}
                    className={`item-card ${selectedItem?.type === 'tool' && selectedItem?.data.name === t.name ? 'selected' : ''}`}
                    onClick={() => selectItem('tool', t)}
                  >
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                    <span className="item-meta">Params: {Object.keys(t.inputSchema?.properties || {}).length}</span>
                  </button>
                ))
              )
            ) : activeTab === 'resources' ? (
              resources.length === 0 ? (
                <div className="empty-state"><p>No resources registered on the server.</p></div>
              ) : (
                resources.map((r) => (
                  <button
                    key={r.uri}
                    className={`item-card ${selectedItem?.type === 'resource' && selectedItem?.data.uri === r.uri ? 'selected' : ''}`}
                    onClick={() => selectItem('resource', r)}
                  >
                    <h3>{r.name}</h3>
                    <p>{r.description}</p>
                    <span className="item-meta">{r.uri}</span>
                  </button>
                ))
              )
            ) : (
              prompts.length === 0 ? (
                <div className="empty-state"><p>No prompts registered on the server.</p></div>
              ) : (
                prompts.map((p) => (
                  <button
                    key={p.name}
                    className={`item-card ${selectedItem?.type === 'prompt' && selectedItem?.data.name === p.name ? 'selected' : ''}`}
                    onClick={() => selectItem('prompt', p)}
                  >
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                    <span className="item-meta">Args: {(p.arguments || []).length}</span>
                  </button>
                ))
              )
            )}
          </div>
        </section>

        {/* Execution Playground Panel */}
        <section className="glass-panel workspace-col playground-view">
          <div className="col-header">
            <h2>Execution Playground</h2>
          </div>

          <div className="col-content">
            {!selectedItem ? (
              <div className="empty-state">
                <HelpCircle size={40} className="empty-icon" />
                <h3>Select an Item</h3>
                <p>Choose any tool, resource, or prompt template from the left explorer to interact with it.</p>
              </div>
            ) : (
              <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* Header Information */}
                <div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', color: '#fff' }}>
                    {selectedItem.type === 'tool' ? 'Tool: ' : selectedItem.type === 'resource' ? 'Resource: ' : 'Prompt: '}
                    <span style={{ color: 'var(--color-primary)' }}>
                      {selectedItem.type === 'resource' ? selectedItem.data.name : selectedItem.data.name}
                    </span>
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedItem.data.description}
                  </p>
                  {selectedItem.type === 'resource' && (
                    <code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.4rem', fontFamily: 'JetBrains Mono', color: 'var(--color-secondary)' }}>
                      {selectedItem.data.uri}
                    </code>
                  )}
                </div>

                {/* Form Inputs */}
                <form onSubmit={executeAction} className="form-card">
                  {selectedItem.type === 'tool' && (
                    <>
                      {Object.entries(selectedItem.data.inputSchema?.properties || {}).map(([key, prop]: [string, any]) => {
                        const required = selectedItem.data.inputSchema?.required || [];
                        const isRequired = required.includes(key);

                        return (
                          <div key={key} className="form-group">
                            <label>
                              <span>{key} {isRequired && <span style={{ color: 'var(--status-disconnected)' }}>*</span>}</span>
                              <span>{prop.type}</span>
                            </label>
                            
                            {prop.enum ? (
                              <select
                                className="form-input"
                                value={formValues[key] || ''}
                                onChange={(e) => handleFormChange(key, e.target.value)}
                              >
                                {prop.enum.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : prop.type === 'string' && (key === 'code' || key === 'snippet' || key === 'message' || prop.description?.toLowerCase().includes('long')) ? (
                              <textarea
                                className="form-input textarea"
                                value={formValues[key] || ''}
                                onChange={(e) => handleFormChange(key, e.target.value)}
                                placeholder={prop.description}
                                required={isRequired}
                              />
                            ) : (
                              <input
                                type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                                className="form-input"
                                value={formValues[key] || ''}
                                onChange={(e) => handleFormChange(key, e.target.value)}
                                placeholder={prop.description}
                                required={isRequired}
                                step="any"
                              />
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {selectedItem.type === 'prompt' && (
                    <>
                      {(selectedItem.data.arguments || []).map((arg: any) => (
                        <div key={arg.name} className="form-group">
                          <label>
                            <span>{arg.name} {arg.required && <span style={{ color: 'var(--status-disconnected)' }}>*</span>}</span>
                            <span>string</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={formValues[arg.name] || ''}
                            onChange={(e) => handleFormChange(arg.name, e.target.value)}
                            placeholder={arg.description}
                            required={arg.required}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  {selectedItem.type === 'resource' && (
                    <div className="info-box">
                      <Info size={16} className="info-icon" />
                      <div>
                        <strong>Resource Reading</strong>
                        <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          This resource is hosted on the server. Clicking the load button will retrieve its content.
                        </p>
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={executing}
                    style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
                  >
                    {executing ? (
                      <>
                        <RefreshCw size={14} className="animate-pulse" /> Executing...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> 
                        {selectedItem.type === 'tool' ? 'Call Tool' : selectedItem.type === 'resource' ? 'Read Resource' : 'Get Prompt Template'}
                      </>
                    )}
                  </button>
                </form>

                {/* Execution Results */}
                {(executionResult || executionError) && (
                  <div className="results-container animate-slide-in">
                    <div className="results-header">
                      <span className="results-title">Response Output</span>
                      {executionError ? (
                        <span style={{ color: 'var(--status-disconnected)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                          <AlertCircle size={12} /> Execution Failed
                        </span>
                      ) : (
                        <span style={{ color: 'var(--status-connected)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                          <CheckCircle size={12} /> Success
                        </span>
                      )}
                    </div>

                    {executionError ? (
                      <div className="results-body" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#fda4af' }}>
                        {executionError}
                      </div>
                    ) : (
                      <div className="results-body">
                        {executionResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Traffic Logs Console Panel */}
        <section className="glass-panel workspace-col log-panel-col">
          <div className="col-header">
            <h2>
              <Terminal size={14} /> Traffic Inspector
            </h2>
            {logs.length > 0 && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setLogs([])}
                title="Clear Logs"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div className="col-content" style={{ padding: '0.8rem' }}>
            <div className="log-console">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
                  No JSON-RPC messages yet. Establish a connection to inspect communications.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={`log-item ${log.direction}`}>
                    <div className="log-item-header">
                      <span className="log-direction">
                        {log.direction === 'sent' ? '→ SENT REQUEST' : log.direction === 'received' ? '← RECEIVED RESPONSE' : '⚡ SYSTEM'}
                      </span>
                      <span className="log-item-time">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="log-body">{log.content}</pre>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
