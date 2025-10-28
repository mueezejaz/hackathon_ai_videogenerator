import { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [userId, setUserId] = useState(null);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const newId = Date.now();
    setUserId(newId);
  }, []);

  useEffect(() => {
    if (!userId || !status || status.isdone || status.iserror) return;

    const interval = setInterval(() => {
      checkStatus(userId);
    }, 3000);

    return () => clearInterval(interval);
  }, [userId, status]);

  const checkStatus = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/status/${id}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      setError('Please enter a topic for your video');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch('http://localhost:3000/createvideo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: inputValue,
          id: userId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      const result = await response.json();
      setStatus(result.data);
      setIsLoading(false);

      checkStatus(userId);
    } catch (err) {
      setError(err.message || 'Failed to create video');
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setInputValue('');
    setStatus(null);
    setError(null);
    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getStatusIcon = () => {
    if (!status) return null;

    if (status.iserror) {
      return <XCircle className="w-6 h-6 text-red-500" />;
    }
    if (status.isdone) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    if (status.isprocessing) {
      return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    }
    return <AlertCircle className="w-6 h-6 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (!status) return 'bg-gray-100';
    if (status.iserror) return 'bg-red-50 border-red-200';
    if (status.isdone) return 'bg-green-50 border-green-200';
    if (status.isprocessing) return 'bg-blue-50 border-blue-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-3">
            AI Video Generator
          </h1>
          <p className="text-gray-600 text-lg">
            Transform your ideas into animated educational videos
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                What would you like to create a video about?
              </label>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., How does photosynthesis work? Explain blockchain technology..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors resize-none h-32"
                disabled={isLoading || (status && status.isprocessing)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={isLoading || (status && status.isprocessing)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {isLoading || (status && status.isprocessing) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Generate Video
                  </>
                )}
              </button>

              {(status || error) && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {status && (
          <div className={`rounded-2xl shadow-lg p-6 border-2 transition-all duration-300 ${getStatusColor()}`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon()}
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">
                  {status.isdone ? 'Video Ready!' :
                    status.iserror ? 'Generation Failed' :
                      status.isprocessing ? 'Processing Your Video' :
                        'Queued'}
                </h3>

                <p className="text-gray-700 text-sm mb-3">
                  {status.message}
                </p>

                {status.isprocessing && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>This may take 2-5 minutes...</span>
                    </div>
                  </div>
                )}

                {status.isdone && status.video_uri && (
                  <div className="mt-4">
                    <video
                      controls
                      className="w-full rounded-xl shadow-lg"
                      src={status.video_uri}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <a
                      href={status.video_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Open in new tab →
                    </a>
                  </div>
                )}

                {status.iserror && (
                  <div className="mt-3 text-sm text-red-700 bg-red-100 p-3 rounded-lg">
                    Please try again with a different topic or rephrase your request.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white bg-opacity-60 backdrop-blur rounded-xl p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-2">How it works:</h4>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">1.</span>
              <span>Enter your topic or question</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">2.</span>
              <span>AI generates a script and visuals using Manim</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">3.</span>
              <span>Voice narration is added automatically</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">4.</span>
              <span>Your educational video is ready to watch!</span>
            </li>
          </ol>
        </div>

        {userId && (
          <div className="mt-4 text-center text-xs text-gray-400">
            Session ID: {userId}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
