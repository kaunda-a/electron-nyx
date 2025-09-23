// client/src/components/tauri-test.tsx
import { useState } from 'react';
import { greet, startServer, getServerStatus } from '@/lib/tauri';

export default function TauriTest() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [serverStatus, setServerStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGreet = async () => {
    if (!name) return;
    try {
      const result = await greet(name);
      setGreeting(result);
    } catch (error) {
      setGreeting(`Error: ${error.message}`);
    }
  };

  const handleStartServer = async () => {
    setLoading(true);
    try {
      const result = await startServer();
      setServerStatus(result);
    } catch (error) {
      setServerStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCheckServerStatus = async () => {
    setLoading(true);
    try {
      const result = await getServerStatus();
      setServerStatus(JSON.stringify(result, null, 2));
    } catch (error) {
      setServerStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Tauri IPC Test</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Greeting Test</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="border p-2 rounded"
          />
          <button
            onClick={handleGreet}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Greet
          </button>
        </div>
        {greeting && (
          <div className="mt-2 p-2 bg-gray-100 rounded">
            <p>{greeting}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Server Management</h3>
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleStartServer}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Server'}
          </button>
          <button
            onClick={handleCheckServerStatus}
            disabled={loading}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Server Status'}
          </button>
        </div>
        {serverStatus && (
          <div className="mt-2 p-2 bg-gray-100 rounded">
            <pre className="text-sm whitespace-pre-wrap">{serverStatus}</pre>
          </div>
        )}
      </div>
    </div>
  );
}