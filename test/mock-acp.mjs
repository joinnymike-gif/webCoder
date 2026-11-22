// Tiny stand-in for an ACP agent (stdio JSON-RPC): answers initialize/session/new/session/prompt
// and "edits" a file so the IDE's refresh path is exercised.
import fs from 'node:fs';
import readline from 'node:readline';

const out = o => process.stdout.write(JSON.stringify(o) + '\n');
readline.createInterface({ input: process.stdin }).on('line', l => {
  const m = JSON.parse(l);
  if (m.method === 'initialize') out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: 1, agentCapabilities: {} } });
  else if (m.method === 'session/new') out({ jsonrpc: '2.0', id: m.id, result: { sessionId: 's1' } });
  else if (m.method === 'session/prompt') {
    const text = m.params.prompt[0].text;
    fs.writeFileSync('agent-was-here.txt', 'prompt: ' + text + '\n'); // cwd is the workspace root
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'write agent-was-here.txt', status: 'completed' } } });
    out({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'echo: ' + text } } } });
    out({ jsonrpc: '2.0', id: m.id, result: { stopReason: 'end_turn' } });
  }
});
