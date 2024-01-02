import logo from './logo.svg';
import './App.css';
import Background from './components/background/Background';

function App() {
  return (
    <div className="App">
      <Background>
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>
            <code>Hey! I'm Tristan</code>
          </h2>
          <h5>This webpage was created with the React Framework!</h5>
          <p>
            Your browser dimensions are {window.innerWidth}x{window.innerHeight}
          </p>
        </header>
      </Background>
    </div>
  );
}

export default App;
