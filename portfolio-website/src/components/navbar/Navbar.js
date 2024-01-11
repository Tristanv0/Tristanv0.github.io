import React from 'react';
import './Navbar.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

const NavbarNav = ({ onHomeClick, onResumeClick, onAboutClick, onProjectsClick, onContactClick }) => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="navbar bg-transparent">
      <Container>
        <Navbar.Toggle aria-controls="basic-navbar-nav" className="fs-3 border-0 shadow-0 ml-auto"/>
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav>
            <Nav.Link className="animation text-white" href="#home" onClick={onHomeClick}>Home</Nav.Link>
            <Nav.Link className="animation text-white" href="#about" onClick={onAboutClick}>About</Nav.Link>
            <Nav.Link className="animation text-white" href="#resume" onClick={onResumeClick}>Resume</Nav.Link>
            <Nav.Link className="animation text-white" href="#projects" onClick={onProjectsClick}>Projects</Nav.Link>
            <Nav.Link className="animation text-white" href="#contact" onClick={onContactClick}>Contact</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavbarNav;
