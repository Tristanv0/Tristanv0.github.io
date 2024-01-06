import React from 'react';
import './Navbar.css';

const Navbar = ({ onHomeClick, onResumeClick, onAboutClick, onProjectsClick, onContactClick }) => {
    return (
        <nav>
            <ul>
                <li><a href='/' onClick={onHomeClick}>Home</a></li>
                <li><a href='/about' onClick={onAboutClick}>About</a></li>
                <li><a href='/resume' onClick={onResumeClick}>Resume</a></li>
                <li><a href='/projects' onClick={onProjectsClick}>Projects</a></li>
                <li><a href='/contact' onClick={onContactClick}>Contact</a></li>
            </ul>
        </nav>
    );
};

export default Navbar;