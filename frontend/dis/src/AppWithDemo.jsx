import React, { useState } from 'react';
import { HiShieldCheck, HiSparkles } from 'react-icons/hi';
import App from './App';
import AIMapDemo from './components/AIMapDemo';

const AppWithDemo = () => {
  const [currentView, setCurrentView] = useState('dashboard');

  if (currentView === 'ai-demo') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900">
        {/* Header with navigation */}
        <div className="navbar bg-black/40 backdrop-blur-2xl border-b border-purple-500/30 shadow-2xl relative z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-violet-900/20"></div>
          <div className="navbar-start relative z-10">
            <h1 className="text-xl font-bold text-white flex items-center gap-3 hover:text-purple-300 transition-all duration-500">
              <div className="relative">
                <HiShieldCheck className="w-8 h-8 text-purple-400 drop-shadow-lg" />
                <div className="absolute inset-0 w-8 h-8 text-purple-400 animate-ping opacity-20">
                  <HiShieldCheck className="w-8 h-8" />
                </div>
              </div>
              <span className="bg-gradient-to-r from-purple-300 via-violet-200 to-white bg-clip-text text-transparent font-extrabold tracking-wide">
                DISASTER RESPONSE HUB
              </span>
            </h1>
          </div>
          <div className="navbar-end gap-3 relative z-10">
            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 backdrop-blur-sm border border-purple-500/30">
              <button 
                className={`btn btn-xs ${currentView === 'dashboard' ? 'btn-primary' : 'btn-ghost'} text-xs font-semibold transition-all duration-300`}
                onClick={() => setCurrentView('dashboard')}
              >
                <HiShieldCheck className="w-3 h-3" />
                Dashboard
              </button>
              <button 
                className={`btn btn-xs ${currentView === 'ai-demo' ? 'btn-primary' : 'btn-ghost'} text-xs font-semibold transition-all duration-300`}
                onClick={() => setCurrentView('ai-demo')}
              >
                <HiSparkles className="w-3 h-3" />
                AI Demo
              </button>
            </div>
          </div>
        </div>
        
        {/* AI Demo Content */}
        <AIMapDemo />
      </div>
    );
  }

  // Dashboard view - render the original App with navigation
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      {/* Header with navigation */}
      <div className="navbar bg-black/40 backdrop-blur-2xl border-b border-purple-500/30 shadow-2xl relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-violet-900/20"></div>
        <div className="navbar-start relative z-10">
          <h1 className="text-xl font-bold text-white flex items-center gap-3 hover:text-purple-300 transition-all duration-500">
            <div className="relative">
              <HiShieldCheck className="w-8 h-8 text-purple-400 drop-shadow-lg" />
              <div className="absolute inset-0 w-8 h-8 text-purple-400 animate-ping opacity-20">
                <HiShieldCheck className="w-8 h-8" />
              </div>
            </div>
            <span className="bg-gradient-to-r from-purple-300 via-violet-200 to-white bg-clip-text text-transparent font-extrabold tracking-wide">
              DISASTER RESPONSE HUB
            </span>
          </h1>
        </div>
        <div className="navbar-end gap-3 relative z-10">
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 backdrop-blur-sm border border-purple-500/30">
            <button 
              className={`btn btn-xs ${currentView === 'dashboard' ? 'btn-primary' : 'btn-ghost'} text-xs font-semibold transition-all duration-300`}
              onClick={() => setCurrentView('dashboard')}
            >
              <HiShieldCheck className="w-3 h-3" />
              Dashboard
            </button>
            <button 
              className={`btn btn-xs ${currentView === 'ai-demo' ? 'btn-primary' : 'btn-ghost'} text-xs font-semibold transition-all duration-300`}
              onClick={() => setCurrentView('ai-demo')}
            >
              <HiSparkles className="w-3 h-3" />
              AI Demo
            </button>
          </div>
        </div>
      </div>
      
      {/* Dashboard Content - render the original App without its header */}
      <div style={{ height: 'calc(100vh - 64px)' }}>
        <App hideHeader={true} />
      </div>
    </div>
  );
};

export default AppWithDemo;