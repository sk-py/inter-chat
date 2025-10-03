import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import ChatInterface from "./components/chat/ChatInterface";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="">
      <ChatInterface />
    </div>
  );
}

export default App;
