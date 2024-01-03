import React from 'react';
import './Navbar.css';

const Navbar = () => {
    return (
        <nav>
            <ul>
                <li><a href='/'>Home</a></li>
                <li><a href='/resume'>Resume</a></li>
                <li><a href='/about'>About</a></li>
                <li><a href='/projects'>Projects</a></li>
                <li><a href='/contact'>Contact</a></li>
            </ul>
        </nav>
    );
};

export default Navbar;