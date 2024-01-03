import logo from './logo.svg';
import './App.css';
import Background from './components/background/Background';
import Navbar from './components/navbar/Navbar';

function App() {
  return (
    <div className="App">
      <Background className="App-background">
        <Navbar></Navbar>
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>
            <code>Hey! I'm Tristan</code>
          </h2>
          <h5>I am a 2nd year Computer Science student at Toronto Metropolitan University.</h5>
          <p>
            Your browser dimensions are {window.innerWidth}x{window.innerHeight}
          </p>
        </header>
      </Background>
    </div>
  );
};

export default App;
