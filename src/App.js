import React, { useState } from 'react';
import './App.css';
import Map from './components/Map';
import Documentation from './components/Documentation';

function App() {
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);

  const handleDocumentationClick = () => {
    setIsDocumentationOpen(true);
  };

  const handleCloseDocumentation = () => {
    setIsDocumentationOpen(false);
  };

  return (
    <div className="App">
      <Map />
      <button
        type="button"
        onClick={handleDocumentationClick}
        className="documentation-link"
      >
        Documentation
      </button>
      <Documentation 
        isOpen={isDocumentationOpen} 
        onClose={handleCloseDocumentation} 
      />
    </div>
  );
}

export default App;
