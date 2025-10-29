import { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle, XCircle, AlertCircle, Video, Sparkles, ChevronRight, Zap, Code, Wand2, Film, ArrowRight } from 'lucide-react';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [userId, setUserId] = useState(null);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);

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
      const response = await fetch(`/status/${id}`);
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
    if (isLoading) {
      return;
    }
    if (status?.isprocessing) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch('createvideo', {
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

  // Landing Page View
  if (!showGenerator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-fuchsia-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-32 left-40 w-80 h-80 bg-violet-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <nav className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Sparkles className="w-10 h-10 text-purple-600 animate-pulse" />
                <div className="absolute inset-0 bg-purple-600 blur-lg opacity-30 animate-pulse"></div>
              </div>
              <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                AI VideoGen
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#demo" className="text-gray-600 hover:text-purple-600 transition-colors font-medium">
                Demo
              </a>
              <a href="#features" className="text-gray-600 hover:text-purple-600 transition-colors font-medium">
                Features
              </a>
            </div>
          </nav>

          {/* Hero Section */}
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 pt-12">
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-700 rounded-full text-sm font-semibold mb-8 shadow-sm">
                <Zap className="w-4 h-4" />
                Powered by Gemini AI & Manim
              </div>

              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold text-gray-900 mb-8 leading-tight">
                Transform Ideas Into
                <br />
                <span className="relative">
                  <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                    Stunning Videos
                  </span>
                  <div className="absolute -bottom-4 left-0 right-0 h-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 blur-sm opacity-50"></div>
                </span>
              </h1>

              <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
                Create professional educational videos with AI-generated scripts,
                <span className="text-purple-600 font-semibold"> mathematical animations</span>, and
                <span className="text-fuchsia-600 font-semibold"> natural voice narration</span> in minutes
              </p>

              <button
                onClick={() => setShowGenerator(true)}
                className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white text-lg font-bold rounded-full hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              >
                <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
                Start Creating Free
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Demo Video Section */}
            <div id="demo" className="max-w-5xl mx-auto mb-24">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">See It In Action</h2>
                <p className="text-lg text-gray-600">Watch a video created from a simple prompt</p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 rounded-3xl blur-2xl opacity-25 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <video
                    controls
                    className="w-full"
                    poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%239333ea'/%3E%3Cstop offset='100%25' style='stop-color:%23ec4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='1920' height='1080'/%3E%3C/svg%3E"
                  >
                    <source src="https://res.cloudinary.com/dxoptpeuq/video/upload/v1761677035/hackathon_videos/vsb7vpunepisfvbkjjsd.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-lg border border-purple-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Prompt used:</span>
                  <span className="font-bold text-gray-900">"What is the internet?"</span>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div id="features" className="mb-24">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                <p className="text-lg text-gray-600">Everything you need to create amazing educational content</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="group bg-white bg-opacity-70 backdrop-blur-md rounded-3xl p-8 border-2 border-purple-100 hover:border-purple-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Script Generation</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Gemini AI creates engaging, educational scripts perfectly tailored to your topic with scene-by-scene narration
                  </p>
                </div>

                <div className="group bg-white bg-opacity-70 backdrop-blur-md rounded-3xl p-8 border-2 border-fuchsia-100 hover:border-fuchsia-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Code className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Manim Animations</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Beautiful mathematical animations and visualizations created with Manim, the same tool used by 3Blue1Brown
                  </p>
                </div>

                <div className="group bg-white bg-opacity-70 backdrop-blur-md rounded-3xl p-8 border-2 border-pink-100 hover:border-pink-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Film className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Auto Voice Sync</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Natural-sounding voice narration automatically synced with animations using Google TTS technology
                  </p>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-3xl p-12 border-2 border-purple-100 mb-24">
              <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">How It Works</h2>
              <div className="grid md:grid-cols-4 gap-8">
                {[
                  { step: '1', icon: Sparkles, title: 'Enter Your Topic', desc: 'Type what you want to explain or teach', color: 'from-purple-500 to-purple-600' },
                  { step: '2', icon: Wand2, title: 'AI Creates Script', desc: 'Gemini generates narration and visual plan', color: 'from-fuchsia-500 to-fuchsia-600' },
                  { step: '3', icon: Code, title: 'Manim Renders', desc: 'Beautiful animations come to life', color: 'from-pink-500 to-pink-600' },
                  { step: '4', icon: Video, title: 'Download Video', desc: 'Your professional video is ready', color: 'from-violet-500 to-violet-600' }
                ].map((item, i) => (
                  <div key={i} className="text-center relative">
                    {i < 3 && (
                      <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-purple-200 to-fuchsia-200"></div>
                    )}
                    <div className={`relative w-24 h-24 bg-gradient-to-br ${item.color} rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl transform hover:scale-110 transition-transform`}>
                      <item.icon className="w-10 h-10 text-white" />
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-gray-900 shadow-lg">
                        {item.step}
                      </div>
                    </div>
                    <h4 className="font-bold text-lg text-gray-900 mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center py-16">
              <div className="inline-block bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 rounded-3xl p-1 shadow-2xl">
                <div className="bg-white rounded-3xl px-12 py-12">
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Create?</h2>
                  <p className="text-lg text-gray-600 mb-8">Start generating professional educational videos in minutes</p>
                  <button
                    onClick={() => setShowGenerator(true)}
                    className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white text-lg font-bold rounded-full hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Play className="w-6 h-6" />
                    Create Your First Video
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
      </div>
    );
  }

  // Generator View (Exact same logic as working code)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => {
            setShowGenerator(false);
            handleReset();
          }}
          className="mb-6 text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-2 transition-colors"
        >
          ← Back to Home
        </button>

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

                <h1 className="text-gray-700 font-semibold text-lg mb-3">
                  {status.message}
                </h1>

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
