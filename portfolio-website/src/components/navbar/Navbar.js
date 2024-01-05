import React from 'react';
import './Navbar.css';

const Navbar = ({ onClick }) => {
    return (
        <nav>
            <ul>
                <li><a href='/' onClick={(event) => onClick(event)}>Home</a></li>
                <li><a href='/resume' onClick={(event) => onClick(event)}>Resume</a></li>
                <li><a href='/about' onClick={(event) => onClick(event)}>About</a></li>
                <li><a href='/projects' onClick={(event) => onClick(event)}>Projects</a></li>
                <li><a href='/contact' onClick={(event) => onClick(event)}>Contact</a></li>
            </ul>
        </nav>
    );
};

export default Navbar;