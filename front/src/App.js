import React from 'react';
import './App.css';
import ReclaimDemo from './components/ReclaimDemo';

function App() {
  return (
    <div className="App" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <header style={{ padding: '2rem', color: '#333' }}>
        <h1 style={{ color: '#4a6baf' }}>Github User Profile 検証</h1>
        <ReclaimDemo />
      </header>
    </div>
  );
}

export default App;